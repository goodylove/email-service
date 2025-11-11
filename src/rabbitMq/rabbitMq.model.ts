export interface QueuePayload {
    request_id: string
    user_id: string
    notification_type: string
    channel_priority: string
    message_data: Record<string, string>
    retry_count: number
}