import { useEffect, useRef, useState } from 'react';
import { fetchCategories, fetchRequests, fetchStatusWorkflow } from '../services/api.js';

export default function useTriageData() {
  const [requests, setRequests] = useState([]);
  const [workflow, setWorkflow] = useState({
    statuses: [],
    transitions: {},
    userTransitionTargets: [],
    editableDraftStatuses: [],
    reviewActions: [],
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const hasLoaded = useRef(false);

  useEffect(() => {
    let isCurrent = true;
    if (!hasLoaded.current) setLoading(true);

    Promise.all([fetchRequests(), fetchStatusWorkflow(), fetchCategories()])
      .then(([nextRequests, nextWorkflow, nextCategories]) => {
        if (!isCurrent) return;
        setRequests(nextRequests);
        setWorkflow(nextWorkflow);
        setCategories(nextCategories);
        setError('');
      })
      .catch((requestError) => {
        if (isCurrent) setError(requestError.message);
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
          hasLoaded.current = true;
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let isCurrent = true;
    let isPolling = false;

    const pollRequests = async () => {
      if (isPolling) return;
      isPolling = true;

      try {
        const nextRequests = await fetchRequests();
        if (isCurrent) {
          setRequests(nextRequests);
          setError('');
        }
      } catch (requestError) {
        if (isCurrent) setError(requestError.message);
      } finally {
        isPolling = false;
      }
    };

    const timer = window.setInterval(() => {
      void pollRequests();
    }, 12000);

    return () => {
      isCurrent = false;
      window.clearInterval(timer);
    };
  }, []);

  return {
    requests,
    workflow,
    categories,
    loading,
    error,
    refresh: () => setReloadKey((key) => key + 1),
  };
}