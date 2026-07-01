# palmier

`palmier-pro` is a minimal MCP server exposing a todo list over HTTP transport.

## Run

```sh
npm install
npm start
```

The server listens on `http://127.0.0.1:19789/mcp`.

## Register with Claude Code

```sh
claude mcp add --transport http palmier-pro http://127.0.0.1:19789/mcp
```

## Tools

- `add_todo(text)` — add a new todo item
- `list_todos()` — list all todo items
- `complete_todo(id)` — mark a todo item as done
- `delete_todo(id)` — remove a todo item
