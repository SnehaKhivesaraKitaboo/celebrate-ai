export const sampleEvent = Object.freeze({
  eventType: 'wedding',
  eventDate: '2027-02-14',
  city: 'Pune',
  guestCount: 150,
  budget: 800000,
  currency: 'INR',
  theme: 'Rustic garden',
  dietaryPreferences: ['vegetarian', 'jain'],
  specialRequirements: 'Wheelchair access',
});

export function samplePlanRaw() {
  return {
    eventSummary: 'A garden wedding in Pune for 150 guests, with vegetarian and Jain catering.',
    theme: {
      name: 'Rustic garden',
      description: 'Greenery, wood, and warm light for an outdoor ceremony.',
      palette: ['#0F5E63', 'Ivory'],
    },
    budget: {
      currency: 'USD',
      total: 1,
      items: [
        { id: 'exp-venue', category: 'Venue', estimated: 300000, notes: 'Ceremony and reception space.' },
        { id: 'exp-catering', category: 'Catering', estimated: 350000, notes: 'Vegetarian and Jain menus.' },
        { id: 'exp-decor', category: 'Decor', estimated: 150000, notes: 'Flowers and lighting.' },
      ],
    },
    timeline: [
      { id: 'task-venue', title: 'Book a venue', daysBeforeEvent: 180, priority: 'high', category: 'Venue' },
      { id: 'task-menu', title: 'Confirm the menu', daysBeforeEvent: 30, priority: 'medium', category: 'Catering' },
      { id: 'task-invites', title: 'Send invitations', daysBeforeEvent: 60, priority: 'medium', category: 'Guests' },
      { id: 'task-runthrough', title: 'Final run-through', daysBeforeEvent: 2, priority: 'low', category: 'Planning' },
    ],
    vendorChecklist: [
      { id: 'ven-venue', category: 'Venue', questions: ['What is included in the hire fee?'], tips: 'Visit at the same time of day as the event.' },
      { id: 'ven-catering', category: 'Catering', questions: ['Can the kitchen keep Jain and vegetarian prep separate?'], tips: 'Ask for a tasting before you commit.' },
      { id: 'ven-photo', category: 'Photography', questions: ['How many hours of coverage are included?'], tips: 'Compare written packages the providers give you.' },
    ],
    ideas: ['Welcome drinks in the garden', 'A handwritten seating plan'],
    assumptions: ['The budget covers one day in one city.', 'Guest count stays at 150.'],
    disclaimer: 'Costs are rough estimates and must be confirmed with local providers.',
  };
}
