# Legacy n8n agent

The original n8n chat widget is preserved in `docs/js/n8n-agent-legacy.js`,
including its webhook URL, welcome messages, CDN bundle, and Love 21 colour
overrides.

To restore it across the site, change one line in `docs/js/agent-config.js`:

```js
window.LOVE21_AGENT_MODE = "n8n";
```

Change the value back to `"deepseek"` to use the role-aware FastAPI/DeepSeek
agent. No other file needs to be replaced.
