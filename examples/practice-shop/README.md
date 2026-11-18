# Example: testing a web shop with the Selenium AI Agent

Everything in this folder was made by Claude with the [Selenium AI Agent](https://www.npmjs.com/package/selenium-ai-agent), after it explored the shop at https://practiceautomatedtesting.com/shopping:

- [`TEST_PLAN.md`](TEST_PLAN.md): what the shop does (requirements R1–R8), the test scenario step by step, and the findings.
- [`test_shopping_checkout.py`](test_shopping_checkout.py): the automated test (pytest + Selenium): search, filters, sorting, product details, cart, checkout with 21% VAT, billing details and payment with iDeal.

```bash
pip install selenium pytest
pytest test_shopping_checkout.py -v
```

Want your AI assistant to do this for your own application? Add the agent to your MCP client:

```json
{ "mcpServers": { "selenium": { "command": "npx", "args": ["-y", "selenium-ai-agent@latest"] } } }
```
