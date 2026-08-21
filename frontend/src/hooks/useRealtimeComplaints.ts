import { useEffect } from 'react';
import { subscribeToRealtimeComplaints, RealtimeComplaintPayload } from '../services/realtimeService';

/**
 * Custom React hook to subscribe components to real-time complaint status updates
 * automatically triggering data refresh without full page reload.
 */
export function useRealtimeComplaints(onUpdate: (payload: RealtimeComplaintPayload) => void) {
  useEffect(() => {
    const unsubscribe = subscribeToRealtimeComplaints(onUpdate);
    return () => {
      unsubscribe();
    };
  }, [onUpdate]);
}
