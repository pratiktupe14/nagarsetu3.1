import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ComplaintStatus } from '../types/database.types';

const REALTIME_CHANNEL_NAME = 'nagarsetu_realtime_channel';
const BROADCAST_BUS_NAME = 'nagarsetu_realtime_bus';
const CUSTOM_EVENT_NAME = 'nagarsetu_complaint_update_event';

export interface RealtimeComplaintPayload {
  complaintId: string;
  oldStatus?: ComplaintStatus;
  newStatus: ComplaintStatus;
  actorName: string;
  note?: string;
  timestamp: string;
}

let broadcastChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_BUS_NAME);
  } catch (e) {
    console.warn('BroadcastChannel initialization note:', e);
  }
}

export function broadcastComplaintChange(
  complaintId: string,
  oldStatus: ComplaintStatus | undefined,
  newStatus: ComplaintStatus,
  actorName: string = 'System User',
  note?: string
) {
  const payload: RealtimeComplaintPayload = {
    complaintId,
    oldStatus,
    newStatus,
    actorName,
    note,
    timestamp: new Date().toISOString()
  };

  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(payload);
    } catch (e) {
      console.warn('BroadcastChannel postMessage note:', e);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: payload }));
  }

  if (isSupabaseConfigured()) {
    try {
      const channel = supabase.channel(REALTIME_CHANNEL_NAME);
      channel.send({
        type: 'broadcast',
        event: 'complaint_status_change',
        payload
      });
    } catch (e) {
      console.warn('Supabase realtime broadcast note:', e);
    }
  }
}

export function subscribeToRealtimeComplaints(onUpdate: (payload: RealtimeComplaintPayload) => void): () => void {
  const handleBroadcast = (event: MessageEvent) => {
    if (event.data && event.data.complaintId) {
      onUpdate(event.data as RealtimeComplaintPayload);
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }

  const handleCustomEvent = (event: Event) => {
    const customEvt = event as CustomEvent<RealtimeComplaintPayload>;
    if (customEvt.detail) {
      onUpdate(customEvt.detail);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);
  }

  let supabaseChannel: any = null;

  if (isSupabaseConfigured()) {
    try {
      supabaseChannel = supabase
        .channel(REALTIME_CHANNEL_NAME)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, (payload) => {
          const newData = payload.new as Record<string, any> | null;
          const oldData = payload.old as Record<string, any> | null;
          onUpdate({
            complaintId: newData?.id || oldData?.id || '',
            newStatus: (newData?.status as ComplaintStatus) || 'Submitted',
            actorName: 'Supabase Realtime',
            timestamp: new Date().toISOString()
          });
        })
        .on('broadcast', { event: 'complaint_status_change' }, (payload) => {
          if (payload.payload) {
            onUpdate(payload.payload as RealtimeComplaintPayload);
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Supabase realtime subscribe note:', e);
    }
  }

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);
    }
    if (supabaseChannel && isSupabaseConfigured()) {
      supabase.removeChannel(supabaseChannel);
    }
  };
}
