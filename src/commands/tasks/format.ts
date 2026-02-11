import type { Task } from "@modelcontextprotocol/sdk/types.js"

export function formatTaskOutput(task: Task) {
	return {
		taskId: task.taskId,
		status: task.status,
		createdAt: task.createdAt,
		lastUpdatedAt: task.lastUpdatedAt,
		...(task.statusMessage && { statusMessage: task.statusMessage }),
		...(task.pollInterval && { pollInterval: `${task.pollInterval}ms` }),
		...(task.ttl != null && { ttl: `${task.ttl}ms` }),
	}
}
