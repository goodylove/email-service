export interface QueuePayload {
    request_id: string;          
    user_id: string;              
    notification_type: string;    
    channel_priority: string;     
    message_data: Record<string, any>; 
    retry_count: number;          
    max_retries?: number;        
    timestamp: string;          
    metadata?: {                  
        source?: string;
        priority?: 'low' | 'normal' | 'high' | 'critical';
        scheduled_for?: string;     // For delayed messages
    };
}