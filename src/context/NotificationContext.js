/**
 * NotificationContext
 * - Stores all alert notifications globally
 * - Tracks unread count (resets when user visits /alerts)
 * - Notifications come in dynamically as ward scans complete
 */
import { createContext, useContext, useState, useCallback, useRef } from "react";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);  // full list
  const [unreadCount, setUnreadCount]     = useState(0);   // bell badge
  const idRef = useRef(0);

  // Add a single notification
  const addNotification = useCallback((notif) => {
    const id = ++idRef.current;
    const item = {
      id,
      wardNo:    notif.wardNo   || null,
      wardName:  notif.wardName || "City",
      level:     notif.level    || "INFO",       // CRITICAL / HIGH / MODERATE / INFO / SUCCESS
      message:   notif.message,
      detail:    notif.detail   || null,
      days:      notif.days     || null,
      avgPct:    notif.avgPct   || null,
      maxPct:    notif.maxPct   || null,
      peakDate:  notif.peakDate || null,
      daysExc:   notif.daysExc  || null,
      timestamp: new Date(),
      read:      false,
    };
    setNotifications(prev => [item, ...prev].slice(0, 100)); // keep last 100
    setUnreadCount(prev => prev + 1);
    return id;
  }, []);

  // Mark all as read (called when user opens alerts page)
  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Clear notifications from a specific scan (to replace with fresh ones)
  const clearByDays = useCallback((days) => {
    setNotifications(prev => prev.filter(n => n.days !== days));
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount,
      addNotification, markAllRead, clearAll, clearByDays,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
