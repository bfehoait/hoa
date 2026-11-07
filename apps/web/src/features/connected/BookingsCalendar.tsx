import { useState } from "react";
import CommunityCalendar from "./CommunityCalendar";
import OperationsDesk from "./OperationsDesk";

/**
 * Availability and booking on one screen.
 *
 * Checking a date and reserving it are one task, so they are one page: the
 * month view shows what is already taken, and picking a day opens the request
 * below it. The booking is created as Pending and holds the slot; only the
 * office can approve it, and that rule lives in the server, not here.
 */
export default function BookingsCalendar() {
  const [requestDate, setRequestDate] = useState<string>();
  return (
    <>
      <CommunityCalendar onPickDay={setRequestDate} />
      <OperationsDesk kind="booking" requestDate={requestDate} />
    </>
  );
}
