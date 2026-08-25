# Tech Runbook troubleshooting JSON

Import JSON files must contain one runbook with `schemaVersion: 2`.

Localized text can be either a plain string or an object with Spanish and English:

```json
{
  "title": {
    "es": "Integracion RFID",
    "en": "RFID Integration"
  }
}
```

Troubleshooting nodes can include these searchable fields:

- `symptoms`: localized user-facing symptoms.
- `errorMessages`: exact terminal/browser/device error variants.
- `aliases`: localized alternative ways a user may describe the problem.
- `keywords`: normalized search terms.
- `tags`: node-specific filters.
- `command`: command or multiline command block to copy.
- `expectedResult`: localized result after running the command.
- `outcomes`: branches with `label` and optional `nextNode`.
- `cause`: localized likely cause.
- `finalSolution`: localized final resolution.

See [vite-command-not-found.json](./vite-command-not-found.json) for an importable example.
