# Contributing to Selenium AI Agent

First off, thank you for considering contributing! 🎉

This project is open source and we love receiving contributions from our community.

## Ways to Contribute

### 🐛 Report Bugs

Found a bug? Please [open an issue](https://github.com/learn-automated-testing/selenium_agent/issues/new) with:
- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Node version, Grid version)

### 💡 Suggest Features

Have an idea? We'd love to hear it! [Open a feature request](https://github.com/learn-automated-testing/selenium_agent/issues/new) describing:
- The problem you're trying to solve
- Your proposed solution
- Alternative approaches you've considered

### 🔧 Submit Code

#### Setting Up Development Environment

```bash
# Clone the repo
git clone https://github.com/learn-automated-testing/selenium_agent.git
cd selenium_agent

# Install dependencies
cd selenium-mcp-server
npm install

# Build
npm run build

# Start Grid for testing
cd ..
docker-compose up -d

# Run the server in development
cd selenium-mcp-server
npm run dev
```

#### Code Structure

```
selenium-mcp-server/src/
├── server.ts          # MCP protocol handler
├── context.ts         # Browser session management
├── grid/              # Selenium Grid integration
│   ├── grid-client.ts
│   ├── session-pool.ts
│   └── exploration-coordinator.ts
├── tools/             # All MCP tools
│   ├── navigation/
│   ├── elements/
│   ├── grid/          # Grid-specific tools
│   ├── agents/        # AI agent tools
│   └── ...
└── utils/
```

#### Adding a New Tool

1. Create a new file in the appropriate `tools/` subdirectory
2. Extend `BaseTool` class
3. Define your Zod schema for input validation
4. Implement the `execute` method
5. Export from the category's `index.ts`
6. Register in `tools/index.ts`

Example:
```typescript
import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';

const schema = z.object({
  param1: z.string().describe('Description of param1'),
});

export class MyNewTool extends BaseTool {
  readonly name = 'my_new_tool';
  readonly description = 'What this tool does';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'browser'; // or navigation, elements, grid, etc.

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { param1 } = this.parseParams(schema, params);
    
    // Your implementation
    const driver = await context.ensureDriver();
    // ...
    
    return this.success('Result message');
  }
}
```

#### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test` (when available)
5. Build to verify: `npm run build`
6. Commit with a clear message: `git commit -m 'Add amazing feature'`
7. Push: `git push origin feature/amazing-feature`
8. Open a Pull Request

### 📝 Improve Documentation

Documentation improvements are always welcome:
- Fix typos or unclear explanations
- Add examples
- Improve the README
- Write tutorials or guides

## Code Style

- TypeScript with strict mode
- Use Zod for all input validation
- Async/await over promises
- Descriptive variable names
- JSDoc comments for public APIs

## Testing

When adding new tools:
- Test manually with Claude Desktop
- Verify with Grid and without Grid
- Check error handling works correctly

## Questions?

- Open a [Discussion](https://github.com/learn-automated-testing/selenium_agent/discussions)
- Check existing [Issues](https://github.com/learn-automated-testing/selenium_agent/issues)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
