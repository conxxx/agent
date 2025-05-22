import asyncio
import logging
import os
import base64 
import json
from typing import Optional, TYPE_CHECKING

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketState

# Configure logging FIRST
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
# Set higher logging levels for verbose libraries
logging.getLogger("google.adk").setLevel(logging.WARNING)
logging.getLogger("google.adk.models.registry").setLevel(logging.WARNING)
logging.getLogger("google_genai").setLevel(logging.WARNING)
logging.getLogger("google.ai.generativelanguage").setLevel(logging.WARNING)
logging.getLogger("google.auth").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

# Updated ADK Imports
from google.adk.sessions import InMemorySessionService, Session as ADKSessionType
from google.adk.runners import Runner
from google.adk.agents.run_config import RunConfig
from google.adk.agents import LiveRequestQueue

if TYPE_CHECKING:
    # Import for type-hinting only to satisfy Pylance
    from google.genai.types import Part as _PartType

try:
    from google.genai.types import Content, Part, Blob
    logger.info("Successfully imported Content, Part, and Blob from google.genai.types.")
except ImportError:
    logger.error("Failed to import Content, Part, and Blob from google.genai.types. This is a critical dependency for ADK streaming examples. Ensure 'google-generativeai' is installed.")
    Content, Part, Blob = None, None, None

# Load environment variables from .env file
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path=dotenv_path)
else:
    logger.warning(f".env file not found at: {dotenv_path}. Relying on pre-set environment variables.")

CUSTOMER_SERVICE_AGENT_LOADED = False
customer_service_agent = None
ADK_MODEL_ID = None

try:
    from customer_service.agent import root_agent as imported_agent
    from customer_service.config import Config as CustomerServiceConfig

    customer_service_agent = imported_agent
    cfg = CustomerServiceConfig()
    ADK_MODEL_ID = getattr(getattr(cfg, "agent_settings", object()), "model", None)
    if not ADK_MODEL_ID: 
        ADK_MODEL_ID = getattr(cfg, "ADK_MODEL_ID", None)

    if customer_service_agent:
        CUSTOMER_SERVICE_AGENT_LOADED = True
    if not ADK_MODEL_ID:
        ADK_MODEL_ID = "gemini-2.0-flash-exp" 
        logger.warning(f"Agent's Model ID not found in customer_service.config. Using default: {ADK_MODEL_ID} for agent context.")

except ImportError as e:
    logger.error(f"Error importing agent or config from customer_service: {e}", exc_info=True)
    if ADK_MODEL_ID is None: ADK_MODEL_ID = "gemini-2.0-flash-exp"
    logger.warning(f"customer_service_agent or its config not found. Agent will not run. Fallback model: {ADK_MODEL_ID}")
except Exception as e:
    logger.error(f"An unexpected error occurred during agent/config import: {e}", exc_info=True)
    if ADK_MODEL_ID is None: ADK_MODEL_ID = "gemini-2.0-flash-exp"

app = FastAPI()

origins = [
    "http://localhost:5000", "http://127.0.0.1:5000",
    "http://localhost:3000", "http://127.0.0.1:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

async def start_agent_session(session_id: str, is_audio: bool):
    if not CUSTOMER_SERVICE_AGENT_LOADED or customer_service_agent is None:
        logger.error("customer_service_agent is not loaded. Cannot start runner.")
        raise RuntimeError("Customer service agent could not be loaded.")

    session_service = InMemorySessionService()
    app_name_str = "cymbal_home_garden_streaming_chat"
    user_id_str = f"user_{session_id}"

    session_obj: ADKSessionType = session_service.get_session(
        app_name=app_name_str, user_id=user_id_str, session_id=session_id
    )
    if not session_obj:
        session_obj = session_service.create_session(
            app_name=app_name_str, user_id=user_id_str, session_id=session_id
        )
    if not session_obj:
        logger.error(f"Critical error: Failed to create or retrieve session for {session_id}")
        raise RuntimeError(f"Session object is None for {session_id}")

    runner = Runner(agent=customer_service_agent, app_name=app_name_str, session_service=session_service)
    live_request_queue = LiveRequestQueue()
    
    run_config = RunConfig(
        response_modalities=["AUDIO"] if is_audio else ["TEXT"],
    )
    
    live_events = runner.run_live(
        session=session_obj, 
        live_request_queue=live_request_queue,
        run_config=run_config,
    )
    return live_events, live_request_queue

# Rewritten agent_to_client_messaging based on ADK documentation
async def agent_to_client_messaging(ws: WebSocket, events_iter: any, session_id: str):
    logger.info(f"Starting agent_to_client_messaging for session: {session_id}")
    try:
        async for agent_event in events_iter:
            logger.info(f"[S2C {session_id}] Raw agent event from events_iter: {agent_event}")

            is_turn_complete = getattr(agent_event, 'turn_complete', False)
            is_interrupted = getattr(agent_event, 'interrupted', False)
            is_interaction_completed = getattr(agent_event, 'interaction_completed', False)

            if is_turn_complete or is_interrupted or is_interaction_completed:
                status_message = {
                    "turn_complete": is_turn_complete,
                    "interrupted": is_interrupted,
                    "interaction_completed": is_interaction_completed,
                }
                logger.info(f"[S2C {session_id}] Sending status: {status_message}")
                await ws.send_json(status_message)
                # Crucial: continue to next event after sending status, as per ADK docs
                continue 
            
            server_content = getattr(agent_event, 'server_content', None) or getattr(agent_event, 'content', None)
            if not server_content:
                # logger.debug(f"[S2C DEBUG {session_id}] Event has no server_content or content.")
                continue

            # --- Start: Preserve existing non-voice command handling ---
            # Check for theme change instruction (Example of preserving custom logic)
            theme_action_details = None
            if isinstance(server_content, dict) and server_content.get("action") == "set_theme":
                theme_action_details = server_content
            elif hasattr(server_content, 'parts') and server_content.parts and \
                 hasattr(server_content.parts[0], 'function_response') and \
                 hasattr(server_content.parts[0].function_response, 'response') and \
                 isinstance(server_content.parts[0].function_response.response, dict) and \
                 server_content.parts[0].function_response.response.get("action") == "set_theme":
                theme_action_details = server_content.parts[0].function_response.response
            
            if theme_action_details:
                theme_value = theme_action_details.get("theme")
                if theme_value:
                    logger.info(f"[S2C {session_id}] Handling 'set_theme' action: {theme_value}")
                    await ws.send_json({"type": "command", "command_name": "set_theme", "payload": {"theme": theme_value}})
                    continue
                else:
                    logger.warning(f"[S2C {session_id}] 'set_theme' action missing theme value.")
                    continue
            
            # Check for cart refresh instruction
            cart_refresh_action = None
            if isinstance(server_content, dict) and server_content.get("action") == "refresh_cart":
                cart_refresh_action = True
            elif hasattr(server_content, 'parts') and server_content.parts and \
                 hasattr(server_content.parts[0], 'function_response') and \
                 hasattr(server_content.parts[0].function_response, 'response') and \
                 isinstance(server_content.parts[0].function_response.response, dict) and \
                 server_content.parts[0].function_response.response.get("action") == "refresh_cart":
                cart_refresh_action = True

            if cart_refresh_action:
                logger.info(f"[S2C {session_id}] Handling 'refresh_cart' action.")
                await ws.send_json({"type": "command", "command_name": "refresh_cart"})
                continue

            # Product recommendations
            product_recommendation_dict = None
            if hasattr(server_content, 'parts') and server_content.parts and \
               hasattr(server_content.parts[0], 'function_response') and \
               hasattr(server_content.parts[0].function_response, 'response') and \
               isinstance(server_content.parts[0].function_response.response, dict) and \
               server_content.parts[0].function_response.response.get("type") == "product_recommendations":
                product_recommendation_dict = server_content.parts[0].function_response.response
            elif isinstance(server_content, dict) and server_content.get("type") == "product_recommendations":
                 product_recommendation_dict = server_content
            
            if product_recommendation_dict:
                logger.info(f"[S2C {session_id}] Handling 'product_recommendations'.")
                await ws.send_text(json.dumps(product_recommendation_dict)) # Client expects raw JSON string for this
                continue

            # Check for trigger_checkout_modal action
            checkout_modal_action = None
            if hasattr(server_content, 'parts') and server_content.parts and \
               hasattr(server_content.parts[0], 'function_response') and \
               hasattr(server_content.parts[0].function_response, 'response') and \
               isinstance(server_content.parts[0].function_response.response, dict) and \
               server_content.parts[0].function_response.response.get("action") == "trigger_checkout_modal":
                checkout_modal_action = server_content.parts[0].function_response.response
            elif isinstance(server_content, dict) and server_content.get("action") == "trigger_checkout_modal":
                checkout_modal_action = server_content
            
            if checkout_modal_action:
                logger.info(f"[S2C {session_id}] Handling 'trigger_checkout_modal' action.")
                await ws.send_json({"type": "command", "command_name": "trigger_checkout_modal", "payload": checkout_modal_action})
                logger.info(f"[S2C {session_id}] Sent 'trigger_checkout_modal' command to client with payload: {checkout_modal_action}")
                continue

            # Check for generic ui_command
            # This expects the LLM to output a valid JSON string in part.text
            # if the content is a ui_command.
            
            # New handler for direct tool responses that are UI commands
            direct_ui_command_payload = None
            if hasattr(server_content, 'parts') and server_content.parts and \
               hasattr(server_content.parts[0], 'function_response') and \
               hasattr(server_content.parts[0].function_response, 'response') and \
               isinstance(server_content.parts[0].function_response.response, dict):
                
                tool_response_dict = server_content.parts[0].function_response.response
                if tool_response_dict.get("action") == "display_ui" and "ui_element" in tool_response_dict and "payload" in tool_response_dict:
                    direct_ui_command_payload = {
                        "type": "ui_command", # Standardize the type for client
                        "command_name": tool_response_dict.get("ui_element"),
                        "payload": tool_response_dict.get("payload")
                    }
                    logger.info(f"[S2C {session_id}] Handling direct 'display_ui' tool response: {direct_ui_command_payload}")
                    await ws.send_json(direct_ui_command_payload)
                    continue # Command handled

            # ADK Documentation style for content parts (text/audio)
            # This part is reached if the event was not a status update or a handled custom command.
            part: Optional[_PartType] = (
                server_content.parts[0]
                if hasattr(server_content, 'parts') and server_content.parts
                else None
            )
            if not part:
                # logger.debug(f"[S2C DEBUG {session_id}] Event content has no parts or is not structured as expected for text/audio.")
                continue

            # Check for generic ui_command using the correctly defined 'part' (e.g. from LLM text output)
            ui_command_details_from_text = None
            if part.text: # Ensure part.text exists before trying to load it
                try:
                    potential_command = json.loads(part.text)
                    if isinstance(potential_command, dict) and potential_command.get("type") == "ui_command":
                        ui_command_details_from_text = potential_command
                except json.JSONDecodeError:
                    # Not a JSON command, or malformed JSON.
                    # It will be handled by the subsequent text/audio block.
                    pass
                except Exception as e:
                    # Catch any other unexpected errors during parsing or checking
                    logger.error(f"[S2C {session_id}] Error processing potential ui_command in part.text: {e}", exc_info=True)

            if ui_command_details_from_text:
                # This section seems to have specific interception logic, keeping it for now.
                if ui_command_details_from_text.get("command_name") == "display_shipping_options_ui":
                    logger.info(f"[S2C {session_id}] Intercepted 'display_shipping_options_ui' from text, sending 'initiate_checkout' to client.")
                    await ws.send_json({"type": "initiate_checkout"}) # This seems like old logic, might need review
                else:
                    logger.info(f"[S2C {session_id}] Handling generic 'ui_command' from part.text: {ui_command_details_from_text}")
                    await ws.send_json(ui_command_details_from_text) # Send the original ui_command
                continue # Command handled, move to next agent_event
            
            # If not a ui_command from text, proceed to send as text or audio
            message_to_send = None
            if part.text: # Check for text first (and it wasn't a ui_command from text)
                message_to_send = {"mime_type": "text/plain", "data": part.text}
                logger.info(f"[S2C {session_id}] Sending text: {part.text[:50]}...")
            elif part.inline_data and part.inline_data.mime_type == "audio/pcm": # Check for audio/pcm
                audio_data = part.inline_data.data
                if audio_data:
                    base64_encoded_audio = base64.b64encode(audio_data).decode("ascii")
                    message_to_send = {
                        "mime_type": "audio/pcm",
                        "data": base64_encoded_audio
                        # No "encoding": "base64" field needed as per ADK client example, client decodes based on mime_type
                    }
                    logger.info(f"[S2C {session_id}] Sending audio/pcm: {len(audio_data)} bytes raw, {len(base64_encoded_audio)} chars b64.")
            
            if message_to_send:
                await ws.send_json(message_to_send)
            # else:
                # logger.debug(f"[S2C DEBUG {session_id}] No text or audio/pcm data found in part: {part}")

    except WebSocketDisconnect:
        logger.info(f"S2C: WebSocket disconnected for session: {session_id}")
    except asyncio.CancelledError:
        logger.info(f"S2C: Task cancelled for session: {session_id}")
    except Exception as e:
        logger.error(f"S2C: Error in agent_to_client_messaging for session {session_id}: {e}", exc_info=True)
    finally:
        logger.info(f"S2C: Agent messaging finished for session: {session_id}")

# Rewritten client_to_agent_messaging based on ADK documentation
async def client_to_agent_messaging(ws: WebSocket, queue_to_agent: LiveRequestQueue, session_id: str):
    logger.info(f"Starting client_to_agent_messaging for session: {session_id}")
    try:
        while True:
            raw_client_message = await ws.receive_text()
            try:
                client_message_json = json.loads(raw_client_message)
                logger.info(f"[C2S {session_id}] Raw client message received and parsed: {client_message_json}")
            except json.JSONDecodeError:
                logger.error(f"[C2S {session_id}] Failed to decode JSON from client: {raw_client_message}", exc_info=True)
                continue # Skip this message

            if "parts" in client_message_json:
                logger.info(f"[C2S {session_id}] Detected 'parts' array in client message. Processing as multimodal.")
                parts_for_adk = []
                valid_parts_assembly = True
                
                client_parts_data = client_message_json.get("parts")
                if not isinstance(client_parts_data, list) or not client_parts_data:
                    logger.warning(f"[C2S {session_id}] 'parts' key found but it's not a non-empty list or is missing: {client_parts_data}")
                    valid_parts_assembly = False
                
                if valid_parts_assembly:
                    for part_data in client_parts_data:
                        if not isinstance(part_data, dict):
                            logger.warning(f"[C2S {session_id}] Invalid part structure (not a dict) in 'parts' array: {part_data}")
                            valid_parts_assembly = False
                            break

                        part_mime_type = part_data.get("mime_type")
                        # Client sends 'data' for the content within each part.
                        part_content_data = part_data.get("data")

                        if not part_mime_type or part_content_data is None:
                            logger.warning(f"[C2S {session_id}] Invalid part received in 'parts' array (missing mime_type or data): {part_data}")
                            valid_parts_assembly = False
                            break
                        
                        data_length_info = len(part_content_data) if isinstance(part_content_data, (str, bytes)) else 'N/A (not str/bytes)'
                        logger.info(f"[C2S {session_id}] Processing part from 'parts' array: mime_type='{part_mime_type}', data_length='{data_length_info}'")

                        if part_mime_type.startswith("image/"):
                            try:
                                decoded_bytes = base64.b64decode(part_content_data)
                                parts_for_adk.append(Part(inline_data=Blob(mime_type=part_mime_type, data=decoded_bytes)))
                                logger.info(f"[C2S {session_id}] Successfully processed image part: mime_type='{part_mime_type}', decoded_bytes_length={len(decoded_bytes)}")
                            except base64.binascii.Error as e:
                                logger.error(f"[C2S {session_id}] Error decoding base64 image data for part {part_data}: {e}", exc_info=True)
                                valid_parts_assembly = False
                                break
                            except Exception as e:
                                logger.error(f"[C2S {session_id}] Generic error processing image part {part_data}: {e}", exc_info=True)
                                valid_parts_assembly = False
                                break
                        elif part_mime_type == "text/plain":
                            # Assuming text data in 'parts' is plain string, not base64 encoded by client.
                            parts_for_adk.append(Part(text=str(part_content_data)))
                            logger.info(f"[C2S {session_id}] Successfully processed text part: '{str(part_content_data)[:100]}...'")
                        else:
                            logger.warning(f"[C2S {session_id}] Unsupported mime_type '{part_mime_type}' in 'parts' array. Skipping part: {part_data}")
                            # To be strict, an unsupported part could invalidate the whole message:
                            # valid_parts_assembly = False
                            # break
                            # Or, to be more lenient, just skip this part (current behavior by not breaking/setting false)

                    if valid_parts_assembly and parts_for_adk:
                        logger.info(f"[C2S {session_id}] Assembled {len(parts_for_adk)} parts for ADK. Constructing Content object.")
                        adk_content_obj = Content(role="user", parts=parts_for_adk)
                        queue_to_agent.send_content(content=adk_content_obj)
                        logger.info(f"[C2S {session_id}] Successfully sent Content object with {len(parts_for_adk)} parts to agent queue.")
                    elif not parts_for_adk and valid_parts_assembly: # No processable parts were found
                         logger.warning(f"[C2S {session_id}] No processable parts found in 'parts' array after processing, nothing to send to agent.")
                    elif not valid_parts_assembly: # An error occurred during part processing
                        logger.warning(f"[C2S {session_id}] Not sending to agent queue due to invalid or empty assembled parts from 'parts' array.")

            # Fallback to existing logic if "parts" is not present OR if "parts" was empty/invalid from the start
            elif "mime_type" in client_message_json:
                logger.info(f"[C2S {session_id}] No 'parts' array or invalid 'parts' array in message. Falling back to mime_type/data processing.")
                mime_type = client_message_json.get("mime_type")
                data = client_message_json.get("data")

                if not mime_type or data is None: # Ensure data is not None, can be empty string for text
                    logger.warning(f"[C2S {session_id}] Received message with missing mime_type or data (fallback path): {client_message_json}")
                    continue

                if mime_type == "text/plain":
                    logger.info(f"[C2S {session_id}] Processing text from client (fallback path): '{str(data)[:50]}...'")
                    # If the message is just "client_ready", skip sending it to the agent
                    if str(data) == "client_ready":
                        logger.info(f"[C2S {session_id}] Received 'client_ready' message. Ignoring for agent processing.")
                        continue
                    content = Content(role="user", parts=[Part.from_text(text=str(data))])
                    logger.info(f"[C2S {session_id}] DEBUG: Text message being added to agent queue: {content}")
                    queue_to_agent.send_content(content=content)
                elif mime_type == "audio/pcm":
                    logger.info(f"[C2S {session_id}] Processing audio/pcm from client (fallback path), data length (base64): {len(data)}")
                    try:
                        base64_audio_str = str(data)
                        decoded_audio_bytes = base64.b64decode(base64_audio_str)
                        logger.info(f"[C2S {session_id}] Length of decoded_audio_bytes (fallback path): {len(decoded_audio_bytes)}")
                        queue_to_agent.send_realtime(Blob(data=decoded_audio_bytes, mime_type="audio/pcm"))
                    except base64.binascii.Error as b64_error:
                        logger.error(f"[C2S {session_id}] Error decoding base64 audio data (fallback path): {b64_error}", exc_info=True)
                        continue
                    except Exception as e:
                        logger.error(f"[C2S {session_id}] Generic error processing audio data (fallback path): {e}", exc_info=True)
                        continue
                elif mime_type.startswith("image/"):
                    logger.warning(f"[C2S {session_id}] Processing image from client (fallback path - this is unexpected if client supports 'parts' array): mime_type: {mime_type}")
                    try:
                        decoded_image_bytes = base64.b64decode(str(data))
                        logger.info(f"[C2S {session_id}] Length of decoded_image_bytes (fallback path): {len(decoded_image_bytes)}")
                        image_blob = Blob(data=decoded_image_bytes, mime_type=mime_type)
                        content = Content(role="user", parts=[Part(inline_data=image_blob)])
                        queue_to_agent.send_content(content=content)
                        logger.info(f"[C2S {session_id}] Image content sent to agent queue (fallback path).")
                    except base64.binascii.Error as b64_error:
                        logger.error(f"[C2S {session_id}] Error decoding base64 image data (fallback path): {b64_error}", exc_info=True)
                        continue
                    except Exception as e:
                        logger.error(f"[C2S {session_id}] Generic error processing image data (fallback path): {e}", exc_info=True)
                        continue
                else:
                    logger.warning(f"[C2S {session_id}] Received unhandled mime_type ('{mime_type}') from client (fallback path): {client_message_json}")
            else:
                logger.warning(f"[C2S {session_id}] Unknown message structure (no 'parts' or 'mime_type' found at top level): {client_message_json}")

    except WebSocketDisconnect:
        logger.info(f"C2S: WebSocket disconnected for session: {session_id}")
    except asyncio.CancelledError:
        logger.info(f"C2S: Task cancelled for session: {session_id}")
    except Exception as e:
        logger.error(f"C2S: Error in client_to_agent_messaging for session {session_id}: {e}", exc_info=True)
    finally:
        logger.info(f"C2S: Client messaging finished for session: {session_id}")


@app.websocket("/ws/agent_stream/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, is_audio: bool = False):
    logger.info(f"WebSocket connection attempt for session: {session_id}, is_audio: {is_audio}")
    
    try:
        await websocket.accept()
        logger.info(f"WebSocket connection accepted for session: {session_id}, is_audio: {is_audio}")
    except WebSocketDisconnect:
        logger.warning(f"WebSocket disconnected before/during accept for session: {session_id}")
        return 
    except Exception as e:
        logger.error(f"Error accepting WebSocket for session {session_id}: {e}", exc_info=True)
        # Attempt to close gracefully if possible, though state might be bad
        if websocket.client_state != WebSocketState.DISCONNECTED:
            try: await websocket.close(code=1011) 
            except: pass # Ignore errors during close after accept failure
        return

    live_events_iterator = None
    agent_send_queue = None
    agent_task = None
    client_task = None

    try:
        live_events_iterator, agent_send_queue = await start_agent_session(session_id, is_audio)

        agent_task = asyncio.create_task(agent_to_client_messaging(websocket, live_events_iterator, session_id))
        agent_task.set_name(f"agent_to_client_{session_id}")
        
        client_task = asyncio.create_task(client_to_agent_messaging(websocket, agent_send_queue, session_id))
        client_task.set_name(f"client_to_agent_{session_id}")

        done, pending = await asyncio.wait(
            [agent_task, client_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task_done in done:
            try:
                task_done.result() 
            except asyncio.CancelledError:
                 logger.info(f"Task {task_done.get_name()} was cancelled for session {session_id}.")
            except Exception as e:
                logger.error(f"Task {task_done.get_name()} completed with error for session {session_id}: {e}", exc_info=True)

        for task_pending in pending:
            logger.info(f"Cancelling pending task: {task_pending.get_name()} for session: {session_id}")
            task_pending.cancel()
        
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected in main endpoint for session: {session_id}")
    except RuntimeError as e: 
        logger.error(f"Runtime error in WebSocket endpoint for session {session_id}: {e}", exc_info=True)
        if websocket.client_state != WebSocketState.DISCONNECTED:
            try: await websocket.send_json({"error": str(e), "type": "RuntimeError"})
            except: pass
    except Exception as e: 
        logger.error(f"Unhandled exception in WebSocket endpoint for session {session_id}: {e}", exc_info=True)
        if websocket.client_state != WebSocketState.DISCONNECTED:
            try: await websocket.send_json({"error": "Internal server error.", "type": "ServerError"})
            except: pass
    finally:
        logger.info(f"Cleaning up WebSocket endpoint for session {session_id}...")
        tasks_to_clean = [t for t in [agent_task, client_task] if t and not t.done()]
        for task in tasks_to_clean:
            if not task.done():
                logger.info(f"Final cancellation for task {task.get_name()} in session {session_id}")
                task.cancel()
        if tasks_to_clean:
            await asyncio.gather(*tasks_to_clean, return_exceptions=True)
        
        if agent_send_queue: # ADK LiveRequestQueue doesn't have an explicit close in examples
            logger.debug(f"LiveRequestQueue for session {session_id} cleanup considered (managed by ADK runner).")

        if websocket.client_state != WebSocketState.DISCONNECTED:
            logger.info(f"Closing WebSocket connection from server side for session {session_id}.")
            try:
                await websocket.close(code=1000) 
            except Exception as e_close:
                logger.error(f"Error closing WebSocket for session {session_id} in finally: {e_close}", exc_info=True)
        logger.info(f"WebSocket endpoint for session {session_id} fully cleaned up.")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Uvicorn server for streaming_server.py")
    
    if not CUSTOMER_SERVICE_AGENT_LOADED:
        logger.critical("CRITICAL: customer_service_agent could not be loaded.")
    if not ADK_MODEL_ID: 
        logger.warning("Agent's primary Model ID is not set.")
        
    uvicorn.run("streaming_server:app", host="0.0.0.0", port=8001, reload=True)
