import { useLocation, useNavigate } from "react-router-dom";
import CommunityCalendar from "./CommunityCalendar";
import OperationsDesk from "./OperationsDesk";

/**
 * Keep schedule browsing separate from the inline booking task. A selected
 * schedule date links into that task; approval remains server-owned.
 */
export default function BookingsCalendar() {
  const location = useLocation();
  const navigate = useNavigate();
  return location.pathname.endsWith("/calendar") ? (
    <CommunityCalendar
      onPickDay={(date) => navigate(`/services/bookings?date=${date}`)}
    />
  ) : (
    <OperationsDesk kind="booking" />
  );
}
