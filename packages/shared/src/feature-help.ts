/** Plain-language guidance only. Never used to grant access or decide outcomes. */
export type FeatureGuide = {
  id: string;
  title: string;
  purpose: string;
  steps: readonly string[];
};

export const featureGuides: readonly FeatureGuide[] = [
  {
    id: "access",
    title: "Roles & permissions",
    purpose: "Choose which pages a person can open and what they can do there.",
    steps: [
      "Roles give a person a workspace, such as Office, Board, Security or Transport. A person can have more than one role.",
      "Turn a page on to make it visible. Turn it off to remove access to that page. When it is on, tick only the actions the person needs, such as Reply or Approve.",
      "A visible page does not automatically allow approvals. An empty action checkbox means that action is not allowed; a dash means its setting could not be checked. Default means the saved role or committee settings are being used.",
      "Review and save your changes. Closing the window does not save them. Developer recovery access cannot be changed here.",
    ],
  },
  {
    id: "overview",
    title: "Overview",
    purpose: "See a summary and find work that needs attention.",
    steps: [
      "Open a card to see the records behind it.",
      "Counts and amounts follow your access. Unavailable means the system cannot provide that figure; it does not mean zero.",
    ],
  },
  {
    id: "reviews",
    title: "Review inbox",
    purpose:
      "Check applications, bookings, passes and other submissions that need a decision.",
    steps: [
      "Choose a submission on the left to see its details.",
      "Check the information before using an available approval or rejection action. Some submissions need extra checks or a reason.",
      "Helpdesk conversations are handled in Helpdesk. The inbox only shows submissions your account is allowed to review.",
    ],
  },
  {
    id: "people",
    title: "People & accounts",
    purpose:
      "Find a member, check their details and manage their account when you have permission.",
    steps: [
      "Search for the person and open their record.",
      "Properties shows verified property links. A typed address alone does not link a property or provide payment history.",
      "Create account sets up sign-in details. Registration applications are requests for review, not sign-in accounts yet.",
    ],
  },
  {
    id: "registrations",
    title: "Registration applications",
    purpose: "Review people applying to join the community.",
    steps: [
      "Open the application and check the applicant's details and property information.",
      "Use only the decisions available to your account. Follow the account setup steps shown after the decision; do not assume an email was sent.",
    ],
  },
  {
    id: "finance",
    title: "Finance",
    purpose: "Check recorded receipts, bills and charges within your access.",
    steps: [
      "Imported receipts show historical payment records. They are not new bills or proof that a bank payment has cleared.",
      "Use the date filters to narrow the records. Download CSV is available only when you have export permission.",
      "Accounting records handles bills, allocations and expenses. Check the record and amount before posting; viewing records does not allow posting.",
    ],
  },
  {
    id: "account",
    title: "My account",
    purpose:
      "See your linked properties, posted charges and available payment records.",
    steps: [
      "Total balance includes charges posted to your account. A monthly rate is the regular charge, not your outstanding balance.",
      "Other includes confirmed amenity charges. Approving a booking and confirming its fee are separate from recording a payment.",
      "Payment history shows receipts allowed by your approved property links. Ask the office if a linked property or receipt is missing.",
      "Continue to Buyani opens the payment provider. Making a payment there does not immediately mark a portal bill as paid.",
    ],
  },
  {
    id: "bookings",
    title: "Amenity bookings",
    purpose:
      "Choose a facility, date and time, and check the booking price before sending your request.",
    steps: [
      "Choose the type of use and complete the required details. Times use Philippine time. Availability and facility rules still apply.",
      "Review the price breakdown. If an amount needs office confirmation, it is not a final charge yet. View the attached guidelines for the published rules.",
      "Office checks the booking and confirms the fee. A posted charge appears under Other in My account; it is not a payment receipt.",
    ],
  },
  {
    id: "calendar",
    title: "Facilities & calendar",
    purpose: "See reservations by date and facility.",
    steps: [
      "Choose a month and select a day to see its reservations.",
      "Use the facility and status filters to narrow the calendar. Open a reservation to check its details; available actions depend on your permissions.",
    ],
  },
  {
    id: "passes",
    title: "Visitor, delivery & gate passes",
    purpose:
      "Prepare a pass for a visitor, small delivery or movement of items.",
    steps: [
      "Choose the pass type, linked household and visit dates. Add the visitor or driver's name and vehicle plate when applicable.",
      "Visitor and small delivery passes go to Security for ID and plate checks. Gate passes need Office approval before Security checks.",
      "A submitted pass is not permission to enter. Check its status and dates; expired or cancelled passes cannot authorize entry.",
    ],
  },
  {
    id: "requests",
    title: "Helpdesk",
    purpose: "Report a concern, read replies and follow the work on it.",
    steps: [
      "Residents: create a request with a clear description and location. Open the same request to read or send replies.",
      "Staff: select a request to read the conversation. Reply, assign work or change its status only when those actions are available.",
      "A reply and a status change are different actions. For emergencies, call the appropriate hotline directly.",
    ],
  },
  {
    id: "announcements",
    title: "Announcements",
    purpose:
      "Read community notices or prepare a notice for the people you choose.",
    steps: [
      "Open a notice to read its text and any image.",
      "When posting, choose the audience and check the text and image before submitting. A submission is not public until the required review and publication are complete.",
      "Unpublish removes a notice from published viewing. History shows the recorded changes, when your account may view them.",
    ],
  },
  {
    id: "lots",
    title: "Lot register & property links",
    purpose:
      "Find a property and check its registered details and account links.",
    steps: [
      "Use the phase, block and lot to find the correct property. Check the match before requesting or approving a link.",
      "An approved link can provide access to that property's records. It does not change the registered owner.",
      "Household occupants are a roster. Adding an occupant does not create a sign-in account or automatically give receipt access.",
    ],
  },
  {
    id: "vehicles",
    title: "Vehicles & stickers",
    purpose: "Submit or review a vehicle record and its sticker request.",
    steps: [
      "Check the plate, vehicle and linked property before submitting.",
      "Follow the request status. A submitted record does not mean a sticker has been approved or issued.",
    ],
  },
  {
    id: "permits",
    title: "Permits & clearances",
    purpose: "Request or review the documents needed for a property activity.",
    steps: [
      "Choose the request type and complete its required information.",
      "Check the details and follow the review status. Approval or issuance is available only to authorized staff.",
    ],
  },
  {
    id: "market",
    title: "Livelihood",
    purpose:
      "Browse community listings, manage your listings and follow your applications.",
    steps: [
      "Use Browse to find listings. My listings shows your own submissions; Applications shows activities you applied to.",
      "Use the add button to choose what to submit. Complete the required details and share only information you may publish.",
      "Submitting a listing does not publish it. Follow its review status; the portal does not confirm a purchase or collect listing payments.",
    ],
  },
  {
    id: "activities",
    title: "Activities & applications",
    purpose: "Find activities and follow the applications you send.",
    steps: [
      "Choose an activity and check its details before applying.",
      "Pending means a decision is still needed. Follow the organizer's instructions; an application is not a payment confirmation.",
    ],
  },
  {
    id: "documents",
    title: "Documents",
    purpose: "Read and download files that your account is allowed to open.",
    steps: [
      "Choose a document. Use the viewer controls to change pages or make the text larger.",
      "Download saves a copy when allowed. Uploading a document does not automatically publish it to everyone.",
    ],
  },
  {
    id: "elections",
    title: "Elections",
    purpose: "Read the election information available to your account.",
    steps: [
      "Open an election to check its dates and published information.",
      "A displayed election notice does not mean online voting is available. Use only the voting or participation steps actually offered.",
    ],
  },
  {
    id: "reports",
    title: "Reports",
    purpose: "Read association reports available to your account.",
    steps: [
      "Open a report to check its reporting period and figures.",
      "Unavailable figures have not been supplied or cannot be read with your access. They should not be treated as zero.",
    ],
  },
  {
    id: "shuttle",
    title: "Community shuttle",
    purpose:
      "Request a ride or manage shuttle requests according to your role.",
    steps: [
      "Residents choose a pickup, destination and passenger count, then follow the request status.",
      "Transport staff open a request and use the available actions as the ride progresses. Updating a ride does not create a payment record.",
      "The stop map helps you choose locations. It is not live vehicle tracking or a guaranteed arrival time.",
    ],
  },
  {
    id: "carpool",
    title: "Carpool",
    purpose: "Find shared rides and follow your ride or application status.",
    steps: [
      "Open a ride to check its pickup, destination and available details before applying.",
      "Follow the driver's decision and the instructions shown for that ride. Applying does not confirm a seat or record a payment.",
    ],
  },
  {
    id: "configuration",
    title: "Office settings",
    purpose:
      "Maintain the office settings that your account is allowed to change.",
    steps: [
      "Choose the setting and check its existing value before editing.",
      "Read the guidance next to the field, then save. Changing a setting does not approve a request or record a payment.",
    ],
  },
  {
    id: "driver-profile",
    title: "Driver profile",
    purpose:
      "Keep the driver and shuttle details available to the office up to date.",
    steps: [
      "Check the fields you are allowed to change, then save.",
      "Vehicle assignments and available actions follow office permissions; a profile change does not grant access to other shuttles.",
    ],
  },
  {
    id: "incidents",
    title: "Security incidents",
    purpose: "Record and follow security incidents available to your account.",
    steps: [
      "Describe what happened and where. Check the details before submitting.",
      "For an urgent incident, contact Security or an emergency service directly. A portal record is not an emergency dispatch.",
    ],
  },
  {
    id: "hotlines",
    title: "Emergency hotlines",
    purpose: "Find office, security, utility and emergency contact numbers.",
    steps: [
      "Swipe the cards or open the full list. Tap a phone number to call.",
      "Portal messages are not monitored as an emergency response service. Call the appropriate service directly.",
    ],
  },
  {
    id: "profile",
    title: "Profile & settings",
    purpose: "Update your profile details and app preferences.",
    steps: [
      "Use the editable fields and save your changes.",
      "Changing your profile does not change your role, registered property ownership or payment status. Ask the office for membership corrections.",
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    purpose: "See updates and open the record they refer to.",
    steps: [
      "Select a notification to open its booking, request or other available record.",
      "Marking an update as read only clears its unread state. It does not approve or complete the underlying request.",
    ],
  },
  {
    id: "services",
    title: "Services",
    purpose:
      "Choose the service you need, such as amenities, passes, Helpdesk or transport.",
    steps: [
      "Open a service and follow its form or instructions.",
      "Your account's role and permissions decide which services and actions are available.",
    ],
  },
  {
    id: "connections",
    title: "Connections",
    purpose:
      "Check the setup information available for services used by the portal.",
    steps: [
      "Read each service's status and any setup instructions.",
      "A configured link is not proof that every service is healthy. Follow the displayed checks before changing a setup.",
    ],
  },
  {
    id: "audit",
    title: "Activity & history",
    purpose: "Check recorded changes and actions available to your account.",
    steps: [
      "Use the filters to find the relevant record or event.",
      "History is for review. Viewing an event does not undo it or give permission to repeat the action.",
    ],
  },
];

const aliases: Readonly<Record<string, string>> = {
  access: "access",
  approvals: "reviews",
  residents: "people",
  members: "people",
  registrations: "registrations",
  finance: "finance",
  accounting: "finance",
  bookings: "bookings",
  calendar: "calendar",
  visitors: "passes",
  gate: "passes",
  requests: "requests",
  "team-requests": "requests",
  inbox: "requests",
  announcements: "announcements",
  updates: "announcements",
  community: "announcements",
  lots: "lots",
  vehicles: "vehicles",
  permits: "permits",
  market: "market",
  learning: "activities",
  participation: "activities",
  documents: "documents",
  elections: "elections",
  governance: "elections",
  reports: "reports",
  shuttle: "shuttle",
  transport: "shuttle",
  carpool: "carpool",
  carpools: "carpool",
  incidents: "incidents",
  hotlines: "hotlines",
  profile: "profile",
  settings: "profile",
  notifications: "notifications",
  services: "services",
  operations: "services",
  connections: "connections",
  activity: "audit",
  modules: "audit",
};

export function featureGuideForPath(path: string): FeatureGuide {
  const parts = path.split(/[?#]/)[0].split("/").filter(Boolean);
  const area = parts[0];
  let id = "overview";
  if (area === "account") id = "account";
  else if (area === "office" && parts[1] === "settings") id = "configuration";
  else if (area === "driver")
    id = parts[1] === "profile" ? "driver-profile" : "shuttle";
  else if (area === "community") id = "announcements";
  else if (area === "explore") {
    id =
      (
        {
          "buy-sell": "market",
          businesses: "market",
          workshops: "activities",
          "booth-events": "activities",
          carpools: "carpool",
          publishing: "announcements",
          "board-records": "documents",
          "board-reports": "reports",
        } as Record<string, string>
      )[parts[1]] ??
      aliases[parts[1]] ??
      "services";
  } else if (parts[1]) id = aliases[parts[1]] ?? "services";
  else id = aliases[area] ?? "overview";
  return featureGuides.find((guide) => guide.id === id)!;
}
