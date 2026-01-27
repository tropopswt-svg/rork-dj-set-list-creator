import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGateOptions {
  title?: string;
  message?: string;
}

export function useAuthGate() {
  const { isAuthenticated } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [modalOptions, setModalOptions] = useState<AuthGateOptions>({});

  /**
   * Check if user is authenticated before performing an action.
   * If not authenticated, shows the auth gate modal.
   * Returns true if authenticated, false if gated.
   */
  const requireAuth = useCallback((
    options?: AuthGateOptions
  ): boolean => {
    if (isAuthenticated) {
      return true;
    }

    setModalOptions(options || {});
    setShowModal(true);
    return false;
  }, [isAuthenticated]);

  /**
   * Wrap an action to require authentication.
   * If not authenticated, shows modal instead of executing action.
   */
  const withAuth = useCallback(<T extends (...args: any[]) => any>(
    action: T,
    options?: AuthGateOptions
  ): T => {
    return ((...args: Parameters<T>) => {
      if (!isAuthenticated) {
        setModalOptions(options || {});
        setShowModal(true);
        return;
      }
      return action(...args);
    }) as T;
  }, [isAuthenticated]);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  return {
    isAuthenticated,
    requireAuth,
    withAuth,
    showModal,
    closeModal,
    modalOptions,
  };
}

export default useAuthGate;
