/**
 * wardScanner.js
 * Scans all 27 zones after a predict, fires toasts + adds to
 * notification bell store dynamically as each result arrives.
 */
import axios from "axios";
import { showToast } from "../components/ToastNotification";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

function getLevel(pct) {
  if (pct >= 20) return "CRITICAL";
  if (pct >= 15) return "HIGH";
  if (pct >= 10) return "MODERATE";
  return "NORMAL";
}

export async function scanAllWards({ days, token, addNotification, clearByDays, threshold = 10 }) {
  try {
    clearByDays(days);
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    const scanRes = await axios.get(`${API}/alerts/scan?threshold=${threshold}&days=${Math.min(days, 90)}`);
    const results = scanRes.data;

    const alerting = results.filter(w => w.Level !== "NORMAL");
    const normal   = results.filter(w => w.Level === "NORMAL");

    let delay = 400;

    // Fire toast + add bell notification per alerting zone with stagger
    for (const ward of alerting) {
      addNotification({
        wardNo:   ward.Ward_No,
        wardName: ward.Ward_Name,
        level:    ward.Level,
        days,
        avgPct:   ward.Avg_Leakage_Pct,
        maxPct:   ward.Max_Leakage_Pct,
        peakDate: ward.Peak_Date,
        daysExc:  ward.Days_Exceeding,
        message:  `Zone ${ward.Ward_No} · ${ward.Ward_Name}: ${ward.Avg_Leakage_Pct.toFixed(1)}% avg leakage over ${days} days`,
        detail:   `Peak: ${ward.Max_Leakage_Pct.toFixed(1)}% on ${ward.Peak_Date} · ${ward.Days_Exceeding}/${days} days exceed threshold`,
      });

      setTimeout(() => {
        showToast(
          `Zone ${ward.Ward_No} · ${ward.Ward_Name} — ${ward.Avg_Leakage_Pct.toFixed(1)}% avg leakage`,
          ward.Level
        );
      }, delay);

      delay += 520;
    }

    // Summary at end
    setTimeout(() => {
      if (alerting.length > 0) {
        const crit = results.filter(w => w.Level === "CRITICAL").length;
        const high = results.filter(w => w.Level === "HIGH").length;
        const mod  = results.filter(w => w.Level === "MODERATE").length;
        const parts = [];
        if (crit) parts.push(`${crit} CRITICAL`);
        if (high) parts.push(`${high} HIGH`);
        if (mod)  parts.push(`${mod} MODERATE`);
        parts.push(`${normal.length} NORMAL`);
        showToast(`${days}-day scan complete — ${parts.join(" · ")}`, "INFO");
        addNotification({
          wardName: "📊 Scan Summary",
          level:    crit > 0 ? "CRITICAL" : high > 0 ? "HIGH" : "MODERATE",
          days,
          message:  `${days}-day forecast: ${alerting.length} zones need attention`,
          detail:   parts.join(" · "),
        });
      } else {
        showToast(`✅ All 27 zones normal — ${days}-day leakage within safe limits`, "SUCCESS");
        addNotification({
          wardName: "✅ All Clear",
          level:    "SUCCESS",
          days,
          message:  `All 27 zones within normal range for ${days}-day forecast`,
          detail:   "No zones exceed 9.52% leakage threshold",
        });
      }
    }, delay + 300);

    return results;
  } catch (err) {
    console.error("Zone scan failed:", err);
    showToast("Zone scan failed — check Flask connection", "HIGH");
    return [];
  }
}
