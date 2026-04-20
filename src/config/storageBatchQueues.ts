export type StorageBatchQueueActionId = 'trash' | 'delete';

export interface StorageBatchQueueActionDefinition {
  id: StorageBatchQueueActionId;
  label: string;
  tone: 'default' | 'danger';
}

export interface StorageBatchQueueDefinition {
  id: string;
  label: string;
  description: string;
  emptyLabel: string;
  supportedActions: StorageBatchQueueActionDefinition[];
}

export const storageBatchQueueDefinitions: StorageBatchQueueDefinition[] = [{
  id: 'cleanup',
  label: 'Cleanup Queue',
  description: 'Stage paths for batch cleanup without tying the queue to immediate selection.',
  emptyLabel: 'Queue files and folders here for batch trash or permanent delete.',
  supportedActions: [
    { id: 'trash', label: 'Trash', tone: 'default' },
    { id: 'delete', label: 'Delete', tone: 'danger' },
  ],
}];

export function getStorageBatchQueueDefinition(
  queueId: string,
): StorageBatchQueueDefinition {
  return storageBatchQueueDefinitions.find((definition) => definition.id === queueId)
    ?? storageBatchQueueDefinitions[0]!;
}
