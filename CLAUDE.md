## Work Tracking with Telora

This project uses Telora for product management and issue tracking via MCP tools.

Product ID: `292c0ee4-fa37-4113-bff8-9a04c087b428`

### Issue Workflow

**Statuses**: To Do -> In Progress -> In Review/Blocked -> Done

**Issue types**: Context Group (groups related tasks), Task, Bug

**Starting work**: List issues with `telora_product_issue_list`, pick one in "To Do", move it to "In Progress" with `telora_product_issue_update`.

**Completing work**: Move the issue to "Done". If you discover new work, create issues with `telora_product_issue_create`.

### MCP Tools Reference

**Products**:
| Tool | Purpose |
|------|---------|
| `telora_product_list` | List all products |
| `telora_product_get` | Get product details by name or ID |
| `telora_product_create` | Create a new product |
| `telora_product_update` | Update product fields |

**Strategies** (directional priorities under a product):
| Tool | Purpose |
|------|---------|
| `telora_product_strategy_list` | List strategies for a product |
| `telora_product_strategy_create` | Create a strategy |
| `telora_product_strategy_update` | Update strategy fields or status |
| `telora_product_strategy_reorder` | Set priority rank order |

**Deliveries** (concrete work items under strategies):
| Tool | Purpose |
|------|---------|
| `telora_product_delivery_list` | List deliveries for a product |
| `telora_product_delivery_create` | Create a delivery |
| `telora_product_delivery_update` | Update delivery fields |
| `telora_product_delivery_reorder` | Set priority rank order |

**Issues** (tasks/bugs under deliveries):
| Tool | Purpose |
|------|---------|
| `telora_product_issue_list` | List issues for a delivery or product |
| `telora_product_issue_create` | Create a Context Group, Task, or Bug |
| `telora_product_issue_update` | Update issue fields or status |
| `telora_product_issue_delete` | Delete an issue |

**OKRs** (objectives and key results):
| Tool | Purpose |
|------|---------|
| `telora_objective_list` | List objectives |
| `telora_objective_create` | Create an objective |
| `telora_objective_get` | Get objective details with key results |
| `telora_objective_update` | Update objective fields or grade |
| `telora_key_result_list` | List key results for an objective |
| `telora_key_result_create` | Create a key result |
| `telora_key_result_update` | Update key result progress |
| `telora_key_result_delete` | Delete a key result |
| `telora_strategy_key_result_link` | Link a strategy to a key result |
| `telora_strategy_key_result_unlink` | Unlink a strategy from a key result |

**Playbooks** (reusable templates):
| Tool | Purpose |
|------|---------|
| `telora_playbook_list` | List available playbooks |
| `telora_playbook_get` | Get playbook details |
| `telora_playbook_create` | Create a playbook template |
| `telora_playbook_instantiate` | Load a playbook into a product |

**Factory** (build-gate cycle orchestration):
| Tool | Purpose |
|------|---------|
| `telora_factory_blueprint_list` | List factory blueprints |
| `telora_factory_blueprint_create` | Create a factory blueprint |
| `telora_factory_blueprint_update` | Update blueprint config or status |
| `telora_factory_instance_get` | Get factory instance details |
| `telora_factory_work_unit_list` | List work units for an instance |
| `telora_factory_work_unit_update` | Update work unit status or description |
| `telora_factory_gate_result_create` | Record a gate result for a work unit |
| `telora_factory_escalate` | Escalate when stuck in a factory context |

**Agents & Daemon**:
| Tool | Purpose |
|------|---------|
| `telora_agent_role_list` | List agent roles |
| `telora_agent_escalate` | Escalate when stuck or needing human input |
| `telora_connector_start` | Set up and start the Telora daemon |
