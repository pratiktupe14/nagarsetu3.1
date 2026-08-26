import { useEffect, useRef } from 'react';
import { subscribeToRealtimeComplaints, RealtimeComplaintPayload } from '../services/realtimeService';

/**
 * Custom React hook to subscribe components to real-time complaint status updates
 * automatically triggering data refresh without full page reload.
 */
export function useRealtimeComplaints(onUpdate: (payload: RealtimeComplaintPayload) => void) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    const unsubscribe = subscribeToRealtimeComplaints((payload) => {
      if (onUpdateRef.current) {
        onUpdateRef.current(payload);
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);
}
