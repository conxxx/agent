import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# Assume a structure for AgentContext and how tools are called.
# This is a placeholder for actual implementation details.
# For instance, AgentContext might hold 'recommendation_cycle_count'
# and tool calls might be methods on a 'tool_caller' object or module.

class AgentContext:
    def __init__(self, customer_id="test_customer_123"):
        self.recommendation_cycle_count = 0
        self.customer_id = customer_id
        # Potentially, a log of agent's verbal outputs or actions
        self.agent_responses = []
        self.tool_calls = [] # To log tool calls for assertions

    def add_response(self, response):
        self.agent_responses.append(response)

    def record_tool_call(self, tool_name, **kwargs):
        self.tool_calls.append({"name": tool_name, "args": kwargs})

    def get_last_tool_call(self, name=None):
        if not self.tool_calls:
            return None
        if name:
            for call in reversed(self.tool_calls):
                if call["name"] == name:
                    return call
            return None
        return self.tool_calls[-1]

# Placeholder for how an agent processes a turn.
# In a real scenario, this would involve the agent's core logic,
# interpreting the prompt, and deciding on actions/tool calls.
async def simulate_agent_processing_after_cart_add(agent_context, added_product_id, added_product_name, mock_tool_manager):
    """
    This is a simplified simulation of the agent's logic post-product addition.
    It directly mimics the steps outlined in the prompt for recommendation.
    A real test would likely involve invoking the main agent loop/handler.
    """

    # --- Start of In-lined Recommendation Logic from Prompt ---
    current_product_id = added_product_id
    current_product_name = added_product_name

    # Recommendation Cycle Logic
    # For this simulation, we assume if current_product_id was from a prior recommendation,
    # recommendation_cycle_count would have been preserved by the calling test.
    # The reset logic (if not from prior rec) is handled in Test Case 6.

    if agent_context.recommendation_cycle_count >= 3:
        # Skip to care instructions
        if "plant" in current_product_name.lower(): # Simplified check
            agent_context.add_response(f"Now that we've added {current_product_name} to your cart, would you like summarized care instructions for it?")
            # mock_tool_manager.send_care_instructions(...) # Potentially
        return

    # Fetch Current Product Details
    agent_context.record_tool_call("search_products", query=current_product_id, customer_id=agent_context.customer_id)
    product_details_response = await mock_tool_manager.search_products(query=current_product_id, customer_id=agent_context.customer_id)
    
    product_details = None
    if product_details_response and product_details_response.get("products"):
        for p in product_details_response["products"]:
            if p.get("id") == current_product_id:
                product_details = p
                break

    if not product_details or not any(k in product_details for k in ["companion_plants_ids", "recommended_soil_ids", "recommended_fertilizer_ids"]):
        if "plant" in current_product_name.lower(): # Simplified check
             agent_context.add_response(f"Now that we've added {current_product_name} to your cart, would you like summarized care instructions for it?")
        return

    # Extract Potential Recommendation IDs
    companion_ids = product_details.get("companion_plants_ids", [])
    soil_ids = product_details.get("recommended_soil_ids", [])
    fertilizer_ids = product_details.get("recommended_fertilizer_ids", [])

    # Compile and Select Recommendation IDs
    all_potential_ids = list(dict.fromkeys(companion_ids + soil_ids + fertilizer_ids)) # unique

    if not all_potential_ids:
        if "plant" in current_product_name.lower(): # Simplified check
             agent_context.add_response(f"Now that we've added {current_product_name} to your cart, would you like summarized care instructions for it?")
        return

    selected_recommendation_ids = []
    for pid in companion_ids:
        if len(selected_recommendation_ids) < 3 and pid in all_potential_ids:
            selected_recommendation_ids.append(pid)
            all_potential_ids.remove(pid) # Ensure uniqueness and correct count
    for pid in soil_ids:
        if len(selected_recommendation_ids) < 3 and pid in all_potential_ids:
            selected_recommendation_ids.append(pid)
            all_potential_ids.remove(pid)
    for pid in fertilizer_ids:
        if len(selected_recommendation_ids) < 3 and pid in all_potential_ids:
            selected_recommendation_ids.append(pid)
            all_potential_ids.remove(pid)
            
    if not selected_recommendation_ids:
        if "plant" in current_product_name.lower(): # Simplified check
             agent_context.add_response(f"Now that we've added {current_product_name} to your cart, would you like summarized care instructions for it?")
        return

    # Increment Recommendation Cycle Counter
    agent_context.recommendation_cycle_count += 1

    # Fetch Details for Recommended Products
    agent_context.record_tool_call("get_product_recommendations", product_ids=selected_recommendation_ids, customer_id=agent_context.customer_id)
    recommended_products_details_list_response = await mock_tool_manager.get_product_recommendations(product_ids=selected_recommendation_ids, customer_id=agent_context.customer_id)
    recommended_products_details_list = recommended_products_details_list_response.get("recommendations", [])

    # Present Recommendations to User
    if recommended_products_details_list:
        intro_message = f"Okay, '{current_product_name}' has been added to your cart! Since you're getting that, you might also be interested in these related items. (This is recommendation cycle {agent_context.recommendation_cycle_count}/3 for items related to the original product):"
        agent_context.add_response(intro_message)
        
        agent_context.record_tool_call("format_product_recommendations_for_display", product_details_list=recommended_products_details_list, original_search_query="Related to " + current_product_name)
        await mock_tool_manager.format_product_recommendations_for_display(product_details_list=recommended_products_details_list, original_search_query="Related to " + current_product_name)

    # Offer Care Instructions
    if "plant" in current_product_name.lower(): # Simplified check
        agent_context.add_response(f"Now that we've added {current_product_name} to your cart, would you like summarized care instructions for it?")
        # Potentially: await mock_tool_manager.send_care_instructions(...)
    # --- End of In-lined Recommendation Logic ---


class TestRecommendationLogic(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        self.mock_tool_manager = MagicMock()
        # Common product definitions
        self.products_db = {
            "SKU_LAVENDER": {"id": "SKU_LAVENDER", "name": "English Lavender 'Munstead'", "companion_plants_ids": ["SKU_ROSEMARY"], "recommended_soil_ids": ["SKU_SOIL_WELLDRAIN"], "type": "plant"},
            "SKU_ROSEMARY": {"id": "SKU_ROSEMARY", "name": "Rosemary officinalis", "companion_plants_ids": ["SKU_SAGE"], "type": "plant"},
            "SKU_SOIL_WELLDRAIN": {"id": "SKU_SOIL_WELLDRAIN", "name": "Well-Draining Potting Mix", "type": "soil"},
            "SKU_SAGE": {"id": "SKU_SAGE", "name": "Garden Sage", "type": "plant"},
            "SKU_PRODUCT_MULTI": {
                "id": "SKU_PRODUCT_MULTI", "name": "Multi-Rec Product", "type": "plant",
                "companion_plants_ids": ["SKU_COMP1", "SKU_COMP2"],
                "recommended_soil_ids": ["SKU_SOIL1", "SKU_SOIL2"],
                "recommended_fertilizer_ids": ["SKU_FERT1", "SKU_FERT2"]
            },
            "SKU_COMP1": {"id": "SKU_COMP1", "name": "Companion 1", "type": "plant"},
            "SKU_COMP2": {"id": "SKU_COMP2", "name": "Companion 2", "type": "plant"},
            "SKU_SOIL1": {"id": "SKU_SOIL1", "name": "Soil 1", "type": "soil"},
            "SKU_PRODUCT_NO_RECS": {"id": "SKU_PRODUCT_NO_RECS", "name": "Plain Plant", "type": "plant", "companion_plants_ids": [], "recommended_soil_ids": [], "recommended_fertilizer_ids": []},
            "SKU_PRODUCT_X": {"id": "SKU_PRODUCT_X", "name": "Product X (New)", "type": "plant", "companion_plants_ids": ["SKU_COMP_X"]},
            "SKU_COMP_X": {"id": "SKU_COMP_X", "name": "Companion X", "type": "plant"},
             "SKU_PRODUCT_A": {"id": "SKU_PRODUCT_A", "name": "Product A", "type": "plant", "companion_plants_ids": ["SKU_PRODUCT_B", "SKU_PRODUCT_C"]},
             "SKU_PRODUCT_B": {"id": "SKU_PRODUCT_B", "name": "Product B", "type": "plant", "companion_plants_ids": ["SKU_PRODUCT_D", "SKU_PRODUCT_E"]},
             "SKU_PRODUCT_C": {"id": "SKU_PRODUCT_C", "name": "Product C", "type": "plant"},
             "SKU_PRODUCT_D": {"id": "SKU_PRODUCT_D", "name": "Product D", "type": "plant", "companion_plants_ids": ["SKU_PRODUCT_F", "SKU_PRODUCT_G"]},
             "SKU_PRODUCT_E": {"id": "SKU_PRODUCT_E", "name": "Product E", "type": "plant"},
             "SKU_PRODUCT_F": {"id": "SKU_PRODUCT_F", "name": "Product F", "type": "plant", "companion_plants_ids": ["SKU_COMP_F"]}, # Used in cycle limit
             "SKU_PRODUCT_G": {"id": "SKU_PRODUCT_G", "name": "Product G", "type": "plant"},
             "SKU_COMP_F": {"id": "SKU_COMP_F", "name": "Companion F", "type": "plant"},
        }

    def _setup_mock_search_products(self, product_id_to_return):
        async def mock_search_fn(query, customer_id):
            # In reality, `query` might be a name. For these tests, we assume direct ID search for simplicity.
            if query in self.products_db:
                return {"products": [self.products_db[query]]}
            return {"products": []}
        self.mock_tool_manager.search_products = AsyncMock(side_effect=mock_search_fn)

    def _setup_mock_get_product_recommendations(self, product_ids_to_return_details_for):
        async def mock_get_recs_fn(product_ids, customer_id):
            recs = []
            for pid in product_ids:
                if pid in self.products_db:
                    recs.append(self.products_db[pid]) # Simplified: returns full product detail
            return {"recommendations": recs}
        self.mock_tool_manager.get_product_recommendations = AsyncMock(side_effect=mock_get_recs_fn)

    def _setup_mock_format_display(self):
        self.mock_tool_manager.format_product_recommendations_for_display = AsyncMock(return_value={"status": "ok"})


    async def test_successful_first_recommendation_set(self):
        agent_context = AgentContext()
        agent_context.recommendation_cycle_count = 0

        self._setup_mock_search_products("SKU_LAVENDER")
        self._setup_mock_get_product_recommendations(["SKU_ROSEMARY", "SKU_SOIL_WELLDRAIN"])
        self._setup_mock_format_display()

        await simulate_agent_processing_after_cart_add(
            agent_context, "SKU_LAVENDER", "English Lavender 'Munstead'", self.mock_tool_manager
        )

        # Assert search_products was called
        search_call = agent_context.get_last_tool_call("search_products")
        self.assertIsNotNone(search_call)
        self.assertEqual(search_call["args"]["query"], "SKU_LAVENDER")

        # Assert get_product_recommendations was called
        get_recs_call = agent_context.get_last_tool_call("get_product_recommendations")
        self.assertIsNotNone(get_recs_call)
        self.assertCountEqual(get_recs_call["args"]["product_ids"], ["SKU_ROSEMARY", "SKU_SOIL_WELLDRAIN"])
        
        # Assert format_product_recommendations_for_display was called
        format_call = agent_context.get_last_tool_call("format_product_recommendations_for_display")
        self.assertIsNotNone(format_call)
        self.assertEqual(format_call["args"]["original_search_query"], "Related to English Lavender 'Munstead'")
        self.assertEqual(len(format_call["args"]["product_details_list"]), 2)


        self.assertIn(
            "Okay, 'English Lavender 'Munstead'' has been added to your cart! Since you're getting that, you might also be interested in these related items. (This is recommendation cycle 1/3 for items related to the original product):",
            agent_context.agent_responses
        )
        self.assertEqual(agent_context.recommendation_cycle_count, 1)
        self.assertIn(
            "Now that we've added English Lavender 'Munstead' to your cart, would you like summarized care instructions for it?",
            agent_context.agent_responses
        )

    async def test_recommendation_limit_of_3_items_per_set(self):
        agent_context = AgentContext()
        agent_context.recommendation_cycle_count = 0

        self._setup_mock_search_products("SKU_PRODUCT_MULTI")
        # Expected: SKU_COMP1, SKU_COMP2, SKU_SOIL1 (companions first, then soil, max 3)
        self._setup_mock_get_product_recommendations(["SKU_COMP1", "SKU_COMP2", "SKU_SOIL1"])
        self._setup_mock_format_display()

        await simulate_agent_processing_after_cart_add(
            agent_context, "SKU_PRODUCT_MULTI", "Multi-Rec Product", self.mock_tool_manager
        )
        
        get_recs_call = agent_context.get_last_tool_call("get_product_recommendations")
        self.assertIsNotNone(get_recs_call)
        self.assertEqual(len(get_recs_call["args"]["product_ids"]), 3)
        self.assertCountEqual(get_recs_call["args"]["product_ids"], ["SKU_COMP1", "SKU_COMP2", "SKU_SOIL1"])

        format_call = agent_context.get_last_tool_call("format_product_recommendations_for_display")
        self.assertIsNotNone(format_call)
        self.assertEqual(len(format_call["args"]["product_details_list"]), 3)

        self.assertEqual(agent_context.recommendation_cycle_count, 1)
        self.assertIn(
            "Now that we've added Multi-Rec Product to your cart, would you like summarized care instructions for it?",
            agent_context.agent_responses
        )

    async def test_chained_recommendation_user_selects_recommended_item(self):
        agent_context = AgentContext()
        # Simulate state after Test Case 1: Lavender added, Rosemary and Soil recommended
        agent_context.recommendation_cycle_count = 1 # Set by previous cycle for Lavender

        # Now user adds SKU_ROSEMARY (which was one of the recommendations)
        self._setup_mock_search_products("SKU_ROSEMARY") # For Rosemary itself
        self._setup_mock_get_product_recommendations(["SKU_SAGE"]) # For Sage, companion of Rosemary
        self._setup_mock_format_display()

        await simulate_agent_processing_after_cart_add(
            agent_context, "SKU_ROSEMARY", "Rosemary officinalis", self.mock_tool_manager
        )

        search_call = agent_context.get_last_tool_call("search_products")
        self.assertEqual(search_call["args"]["query"], "SKU_ROSEMARY")

        # Crucially, cycle count should NOT have been reset
        self.assertEqual(agent_context.recommendation_cycle_count, 2) # Incremented from 1 to 2

        get_recs_call = agent_context.get_last_tool_call("get_product_recommendations")
        self.assertIsNotNone(get_recs_call)
        self.assertCountEqual(get_recs_call["args"]["product_ids"], ["SKU_SAGE"])
        
        format_call = agent_context.get_last_tool_call("format_product_recommendations_for_display")
        self.assertIsNotNone(format_call)

        self.assertIn(
            "Okay, 'Rosemary officinalis' has been added to your cart! Since you're getting that, you might also be interested in these related items. (This is recommendation cycle 2/3 for items related to the original product):",
            agent_context.agent_responses
        )
        self.assertIn(
            "Now that we've added Rosemary officinalis to your cart, would you like summarized care instructions for it?",
            agent_context.agent_responses
        )

    async def test_recommendation_cycle_limit_reached_max_3_cycles(self):
        agent_context = AgentContext()
        # Simulate state after Product A -> B, C (cycle 1), User adds B -> D, E (cycle 2), User adds D -> F, G (cycle 3)
        agent_context.recommendation_cycle_count = 3 # Manually set to simulate reaching the limit

        # User now adds Product F (which was recommended in the 3rd cycle)
        # Mock search for F, though it shouldn't be used for *further* recommendations
        self._setup_mock_search_products("SKU_PRODUCT_F")
        self.mock_tool_manager.get_product_recommendations = AsyncMock() # Should not be called
        self.mock_tool_manager.format_product_recommendations_for_display = AsyncMock() # Should not be called
        
        await simulate_agent_processing_after_cart_add(
            agent_context, "SKU_PRODUCT_F", "Product F", self.mock_tool_manager
        )
        
        # Assert that recommendation_cycle_count remains 3 (not reset, not incremented beyond)
        self.assertEqual(agent_context.recommendation_cycle_count, 3)

        # Assert that no NEW recommendations were fetched or displayed
        # The search_products for F itself would be called by the basic logic, but not for its companions.
        search_call_for_F = agent_context.get_last_tool_call("search_products")
        self.assertIsNotNone(search_call_for_F) # This is okay, to know F's type for care instructions
        self.assertEqual(search_call_for_F["args"]["query"], "SKU_PRODUCT_F")


        self.mock_tool_manager.get_product_recommendations.assert_not_called()
        self.mock_tool_manager.format_product_recommendations_for_display.assert_not_called()
        
        # Only care instructions should be offered
        self.assertIn(
            "Now that we've added Product F to your cart, would you like summarized care instructions for it?",
            agent_context.agent_responses
        )
        self.assertNotIn(
            "Okay, 'Product F' has been added to your cart! Since you're getting that, you might also be interested in these related items.",
            "".join(agent_context.agent_responses) # Check all responses
        )


    async def test_no_relevant_ids_found_for_recommendation(self):
        agent_context = AgentContext()
        agent_context.recommendation_cycle_count = 0

        self._setup_mock_search_products("SKU_PRODUCT_NO_RECS") # Product has no rec IDs
        self.mock_tool_manager.get_product_recommendations = AsyncMock()
        self.mock_tool_manager.format_product_recommendations_for_display = AsyncMock()

        await simulate_agent_processing_after_cart_add(
            agent_context, "SKU_PRODUCT_NO_RECS", "Plain Plant", self.mock_tool_manager
        )

        search_call = agent_context.get_last_tool_call("search_products")
        self.assertIsNotNone(search_call)
        self.assertEqual(search_call["args"]["query"], "SKU_PRODUCT_NO_RECS")
        
        self.mock_tool_manager.get_product_recommendations.assert_not_called()
        self.mock_tool_manager.format_product_recommendations_for_display.assert_not_called()
        
        # recommendation_cycle_count should remain 0 as no recommendations were made
        self.assertEqual(agent_context.recommendation_cycle_count, 0)
        
        self.assertIn(
            "Now that we've added Plain Plant to your cart, would you like summarized care instructions for it?",
            agent_context.agent_responses
        )
        self.assertNotIn(
            "Okay, 'Plain Plant' has been added to your cart! Since you're getting that, you might also be interested in these related items.",
            "".join(agent_context.agent_responses)
        )

    async def test_user_adds_new_product_not_from_recommendations_counter_reset(self):
        agent_context = AgentContext()
        # Simulate: Product A added -> Recommends B, C. Cycle count becomes 1.
        # We don't need to run the full simulation for A, just set the state.
        agent_context.recommendation_cycle_count = 1 # After A's recommendations

        # User now adds Product X (completely new, not B or C)
        self._setup_mock_search_products("SKU_PRODUCT_X") # For Product X
        self._setup_mock_get_product_recommendations(["SKU_COMP_X"]) # For X's companion
        self._setup_mock_format_display()
        
        # Crucial part: the main agent logic (not part of simulate_agent_processing_after_cart_add)
        # would need to detect that SKU_PRODUCT_X was NOT from the last set of recommendations
        # and reset recommendation_cycle_count BEFORE calling the recommendation sub-logic.
        # We simulate this reset here:
        agent_context.recommendation_cycle_count = 0 # Simulating reset by main agent flow

        await simulate_agent_processing_after_cart_add(
            agent_context, "SKU_PRODUCT_X", "Product X (New)", self.mock_tool_manager
        )

        search_call = agent_context.get_last_tool_call("search_products")
        self.assertEqual(search_call["args"]["query"], "SKU_PRODUCT_X")

        # Cycle count should now be 1 (for Product X's own recommendations)
        self.assertEqual(agent_context.recommendation_cycle_count, 1) 

        get_recs_call = agent_context.get_last_tool_call("get_product_recommendations")
        self.assertIsNotNone(get_recs_call)
        self.assertCountEqual(get_recs_call["args"]["product_ids"], ["SKU_COMP_X"])

        format_call = agent_context.get_last_tool_call("format_product_recommendations_for_display")
        self.assertIsNotNone(format_call)
        self.assertIn(
             "Okay, 'Product X (New)' has been added to your cart! Since you're getting that, you might also be interested in these related items. (This is recommendation cycle 1/3 for items related to the original product):",
            agent_context.agent_responses
        )
        self.assertIn(
            "Now that we've added Product X (New) to your cart, would you like summarized care instructions for it?",
            agent_context.agent_responses
        )

    async def test_product_added_but_search_products_fails(self):
        agent_context = AgentContext()
        agent_context.recommendation_cycle_count = 0

        # Mock search_products to return empty or insufficient data
        self.mock_tool_manager.search_products = AsyncMock(return_value={"products": []}) # Empty result
        # Or: self.mock_tool_manager.search_products = AsyncMock(return_value={"products": [{"id": "SKU_FAIL", "name": "Failed Product"}]}) # No rec fields

        self.mock_tool_manager.get_product_recommendations = AsyncMock()
        self.mock_tool_manager.format_product_recommendations_for_display = AsyncMock()

        await simulate_agent_processing_after_cart_add(
            agent_context, "SKU_FAIL", "Failed Product Plant", self.mock_tool_manager # Assume "Plant" in name for care instructions part
        )

        self.mock_tool_manager.search_products.assert_called_once_with(query="SKU_FAIL", customer_id=agent_context.customer_id)
        self.mock_tool_manager.get_product_recommendations.assert_not_called()
        self.mock_tool_manager.format_product_recommendations_for_display.assert_not_called()

        self.assertEqual(agent_context.recommendation_cycle_count, 0)
        self.assertIn(
            "Now that we've added Failed Product Plant to your cart, would you like summarized care instructions for it?", # Falls through to care
            agent_context.agent_responses
        )
        self.assertNotIn(
            "Okay, 'Failed Product Plant' has been added to your cart! Since you're getting that, you might also be interested in these related items.",
            "".join(agent_context.agent_responses)
        )

if __name__ == '__main__':
    unittest.main()
