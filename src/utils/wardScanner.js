/**
 * wardScanner.js
 * Scans all 27 zones after a predict — fires toasts + bell notifications.
 */
import axios from "axios";
import { showToast } from "../components/ToastNotification";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

const STAGGER_MS = 520; // delay between each zone notification

export async function scanAllWards({ days, token, addNotification, clearByDays, threshold = 10 }) {
  try {
    // Clear previous notifications for this day count
    if (clearByDays) clearByDays(days);

    const res = await axios.get(`${API}/alerts/scan?days=${days}&threshold=${threshold}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const results = res.data;

    // Fire staggered toasts + bell notifications
    results.forEach((zone, index) => {
      setTimeout(() => {
        const level  = zone.Level;
        const msg    = `Zone ${zone.Ward_No} ${zone.Ward_Name}: ${level} — ${zone.Avg_Leakage_Pct.toFixed(1)}% avg leakage`;

        // Toast popup
        if (level !== "NORMAL") {
          showToast(msg, level);
        }

        // Bell notification
        if (addNotification) {
          addNotification({
            ward_no:   zone.Ward_No,
            ward_name: zone.Ward_Name,
            level,
            avg_pct:   zone.Avg_Leakage_Pct,
            max_pct:   zone.Max_Leakage_Pct,
            days,
            message:   msg,
            timestamp: new Date().toISOString(),
          });
        }
      }, index * STAGGER_MS);
    });

    return results;
  } catch (err) {
    showToast("Ward scan failed — check if API is running", "ERROR");
    throw err;
  }
}
