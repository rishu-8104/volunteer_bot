// api/index.js - Main Vercel serverless function
require('dotenv').config();
const { App, ExpressReceiver } = require('@slack/bolt');
const express = require('express');
const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

// Initialize Express app
const expressApp = express();
expressApp.use(express.json());
expressApp.use(express.urlencoded({ extended: true }));

// Initialize ExpressReceiver
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true
});

// Initialize Slack Bolt app
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: receiver
});

// Enhanced function to extract key information from user messages
const parseVolunteerRequest = (text) => {
  const lowerText = text.toLowerCase();

  // Extract team size - look for various patterns
  let teamSize = 1; // default

  // Patterns: "5 people", "3 person", "ten volunteers", "a group of 8", "we are 4"
  const teamSizePatterns = [
    /(\d+)\s*(?:people?|person|volunteers?)/i,
    /(?:group\s+of|team\s+of|we\s+are)\s*(\d+)/i,
    /(\d+)\s*(?:members?|folks|individuals?)/i,
    /(?:about|around|approximately)\s*(\d+)/i
  ];

  for (const pattern of teamSizePatterns) {
    const match = text.match(pattern);
    if (match) {
      teamSize = parseInt(match[1]);
      break;
    }
  }

  // Extract activity type - look for keywords and phrases
  const activityKeywords = {
    'environmental cleanup': ['environmental', 'cleanup', 'beach cleanup', 'park cleanup', 'trash', 'litter', 'conservation', 'nature', 'green', 'eco'],
    'food bank': ['food bank', 'food sorting', 'food distribution', 'meal prep', 'kitchen', 'cooking', 'feeding', 'hunger', 'food drive'],
    'animal shelter': ['animal shelter', 'animal care', 'pets', 'dogs', 'cats', 'animals', 'veterinary', 'adoption', 'animal rescue'],
    'community garden': ['community garden', 'gardening', 'planting', 'vegetables', 'farming', 'garden', 'plants', 'agriculture'],
    'tutoring': ['tutoring', 'teaching', 'education', 'homework', 'students', 'school', 'learning', 'mentoring', 'academic'],
    'senior care': ['senior', 'elderly', 'old people', 'retirement', 'nursing home', 'aged care'],
    'disability support': ['disability', 'disabled', 'special needs', 'accessibility', 'inclusive'],
    'youth programs': ['youth', 'teenagers', 'kids', 'children', 'young people', 'adolescents']
  };

  let activity = 'general volunteering'; // default

  // Find the best matching activity
  for (const [activityType, keywords] of Object.entries(activityKeywords)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      activity = activityType;
      break;
    }
  }

  // Extract timing preferences - look for various time references
  const timePatterns = {
    'weekend': ['weekend', 'saturday', 'sunday', 'sat', 'sun'],
    'weekday': ['weekday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'mon', 'tue', 'wed', 'thu', 'fri'],
    'morning': ['morning', 'am', '9am', '10am', '11am', 'early'],
    'afternoon': ['afternoon', 'pm', '1pm', '2pm', '3pm', '4pm', '5pm'],
    'evening': ['evening', '6pm', '7pm', '8pm', '9pm', 'late'],
    'next week': ['next week', 'following week', 'upcoming week'],
    'this week': ['this week', 'current week'],
    'tomorrow': ['tomorrow', 'next day'],
    'flexible': ['flexible', 'anytime', 'whenever', 'open', 'available']
  };

  let timing = 'flexible'; // default

  // Find the best matching timing
  for (const [timeType, keywords] of Object.entries(timePatterns)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      timing = timeType;
      break;
    }
  }

  // Special handling for specific days
  const specificDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayMatch = specificDays.find(day => lowerText.includes(day));
  if (dayMatch) {
    timing = dayMatch;
  }

  // Handle "next" + day patterns
  const nextDayMatch = text.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (nextDayMatch) {
    timing = `next ${nextDayMatch[1]}`;
  }

  return {
    teamSize,
    activity,
    timing,
    originalText: text // Keep original for debugging
  };
};

// Volunteer opportunities database (JavaScript array)
const volunteerOpportunities = [
  {
    id: 1,
    title: 'Beach Cleanup',
    ngo_name: 'Ocean Conservation Society',
    activity_type: 'environmental cleanup',
    location: 'Santa Monica Beach',
    date_available: '2024-01-15',
    time_slot: 'Saturday 9am-12pm',
    max_participants: 25,
    contact_email: 'volunteer@oceanconservation.org',
    description: 'Help clean up plastic waste and debris from the beach'
  },
  {
    id: 2,
    title: 'Food Sorting',
    ngo_name: 'Tampere Food Bank',
    activity_type: 'food bank',
    location: 'Tampere City Center',
    date_available: '2024-01-20',
    time_slot: 'Saturday 2-5pm',
    max_participants: 12,
    contact_email: 'volunteers@tampere-foodbank.fi',
    description: 'Sort and package donated food items for distribution'
  },
  {
    id: 3,
    title: 'Animal Care',
    ngo_name: 'Helsinki Animal Shelter',
    activity_type: 'animal shelter',
    location: 'Helsinki East District',
    date_available: '2024-01-18',
    time_slot: 'Thursday 10am-2pm',
    max_participants: 8,
    contact_email: 'care@helsinki-animals.fi',
    description: 'Feed, walk, and care for rescued animals'
  },
  {
    id: 4,
    title: 'Community Garden',
    ngo_name: 'Green Spaces Initiative',
    activity_type: 'community garden',
    location: 'Espoo Community Center',
    date_available: '2024-01-22',
    time_slot: 'Monday 1-4pm',
    max_participants: 15,
    contact_email: 'garden@greenspaces.fi',
    description: 'Plant vegetables and maintain community garden plots'
  },
  {
    id: 5,
    title: 'Tutoring Program',
    ngo_name: 'Education for All',
    activity_type: 'tutoring',
    location: 'Turku Library',
    date_available: '2024-01-19',
    time_slot: 'Friday 3-6pm',
    max_participants: 10,
    contact_email: 'tutoring@educationforall.fi',
    description: 'Help students with homework and study skills'
  },
  {
    id: 6,
    title: 'Senior Center Activities',
    ngo_name: 'Golden Years Foundation',
    activity_type: 'general volunteering',
    location: 'Vantaa Senior Center',
    date_available: '2024-01-21',
    time_slot: 'Sunday 11am-3pm',
    max_participants: 20,
    contact_email: 'activities@goldenyears.fi',
    description: 'Organize games and activities for elderly residents'
  },
  {
    id: 7,
    title: 'Homeless Shelter Meal Prep',
    ngo_name: 'Hope for Tomorrow',
    activity_type: 'food bank',
    location: 'Oulu Downtown',
    date_available: '2024-01-17',
    time_slot: 'Wednesday 5-8pm',
    max_participants: 18,
    contact_email: 'meals@hopefortomorrow.fi',
    description: 'Prepare and serve meals for homeless community'
  },
  {
    id: 8,
    title: 'Environmental Education',
    ngo_name: 'Nature Conservation Finland',
    activity_type: 'environmental cleanup',
    location: 'Lahti Nature Reserve',
    date_available: '2024-01-25',
    time_slot: 'Saturday 8am-1pm',
    max_participants: 30,
    contact_email: 'education@natureconservation.fi',
    description: 'Teach children about environmental protection'
  },
  {
    id: 9,
    title: 'Disability Support',
    ngo_name: 'Inclusive Community',
    activity_type: 'general volunteering',
    location: 'Jyväskylä Community Center',
    date_available: '2024-01-23',
    time_slot: 'Tuesday 2-5pm',
    max_participants: 12,
    contact_email: 'support@inclusivecommunity.fi',
    description: 'Assist with recreational activities for disabled adults'
  },
  {
    id: 10,
    title: 'Youth Mentoring',
    ngo_name: 'Future Leaders Program',
    activity_type: 'tutoring',
    location: 'Tampere Youth Center',
    date_available: '2024-01-24',
    time_slot: 'Wednesday 4-7pm',
    max_participants: 15,
    contact_email: 'mentoring@futureleaders.fi',
    description: 'Mentor teenagers in career and life skills'
  },
  {
    id: 11,
    title: 'Park Restoration',
    ngo_name: 'Urban Green Spaces',
    activity_type: 'environmental cleanup',
    location: 'Helsinki Central Park',
    date_available: '2024-01-26',
    time_slot: 'Friday 9am-2pm',
    max_participants: 22,
    contact_email: 'restoration@urbangreen.fi',
    description: 'Restore walking trails and plant native species'
  },
  {
    id: 12,
    title: 'Emergency Food Distribution',
    ngo_name: 'Crisis Support Network',
    activity_type: 'food bank',
    location: 'Espoo Emergency Center',
    date_available: '2024-01-27',
    time_slot: 'Saturday 10am-4pm',
    max_participants: 25,
    contact_email: 'distribution@crisissupport.fi',
    description: 'Distribute emergency food packages to families in need'
  },
  {
    id: 13,
    title: 'Pet Adoption Event',
    ngo_name: 'Finnish Animal Rescue',
    activity_type: 'animal shelter',
    location: 'Vantaa Shopping Center',
    date_available: '2024-01-28',
    time_slot: 'Sunday 12-6pm',
    max_participants: 16,
    contact_email: 'adoption@finnishanimalrescue.fi',
    description: 'Help with pet adoption event and animal care'
  },
  {
    id: 14,
    title: 'Community Kitchen',
    ngo_name: 'Shared Meals Initiative',
    activity_type: 'food bank',
    location: 'Turku Community Kitchen',
    date_available: '2024-01-29',
    time_slot: 'Monday 6-9pm',
    max_participants: 14,
    contact_email: 'kitchen@sharedmeals.fi',
    description: 'Cook and serve community meals for low-income families'
  },
  {
    id: 15,
    title: 'Digital Literacy Training',
    ngo_name: 'Tech for Everyone',
    activity_type: 'tutoring',
    location: 'Oulu Public Library',
    date_available: '2024-01-30',
    time_slot: 'Tuesday 10am-2pm',
    max_participants: 8,
    contact_email: 'training@techforeveryone.fi',
    description: 'Teach basic computer skills to elderly community members'
  }
];

const findMatches = async (request) => {
  console.log('Finding matches for:', request);

  // Basic filter function that matches user requests to opportunities
  let matches = volunteerOpportunities.filter(opportunity => {
    // 1. Check if activity keywords match the opportunity title or activity type
    const activityKeywords = request.activity.toLowerCase().split(' ');
    const opportunityText = `${opportunity.title} ${opportunity.activity_type}`.toLowerCase();

    const activityMatch = activityKeywords.some(keyword =>
      opportunityText.includes(keyword) || keyword === 'general' || keyword === 'volunteering'
    );

    // 2. Check if team size fits within capacity (user wants 8, opportunity must have 8+ capacity)
    const capacityMatch = request.teamSize <= opportunity.max_participants;

    // 3. Basic timing match (optional - can be flexible)
    let timingMatch = true; // Default to true for simplicity

    // If user specified a specific timing preference, try to match it
    if (request.timing !== 'flexible') {
      const userTiming = request.timing.toLowerCase();
      const opportunityTime = opportunity.time_slot.toLowerCase();

      // Check for day matches
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const dayMatch = days.find(day => userTiming.includes(day) && opportunityTime.includes(day));

      // Check for time period matches
      const timePeriodMatch =
        (userTiming.includes('weekend') && (opportunityTime.includes('saturday') || opportunityTime.includes('sunday'))) ||
        (userTiming.includes('weekday') && !opportunityTime.includes('saturday') && !opportunityTime.includes('sunday')) ||
        (userTiming.includes('morning') && (opportunityTime.includes('am') || opportunityTime.includes('morning'))) ||
        (userTiming.includes('afternoon') && (opportunityTime.includes('pm') || opportunityTime.includes('afternoon'))) ||
        (userTiming.includes('evening') && (opportunityTime.includes('evening') || opportunityTime.includes('6pm') || opportunityTime.includes('7pm') || opportunityTime.includes('8pm')));

      timingMatch = !!dayMatch || timePeriodMatch;
    }

    const isMatch = activityMatch && capacityMatch && timingMatch;

    if (isMatch) {
      console.log(`✓ Match found: ${opportunity.title} (${opportunity.max_participants} capacity)`);
    }

    return isMatch;
  });

  console.log(`Found ${matches.length} matches`);

  // If no specific matches, return some general opportunities that fit capacity
  if (matches.length === 0) {
    console.log('No specific matches, showing general opportunities');
    matches = volunteerOpportunities.filter(opp => opp.max_participants >= request.teamSize).slice(0, 3);
  }

  // Limit to top 5 matches
  return matches.slice(0, 5);
};

// In-memory storage for bookings and completions (in production, use a database)
const bookings = new Map();
const completedVolunteerWork = new Map();

const saveRequest = async (requestData) => {
  // Mock save - in real implementation, save to database
  return { id: Math.floor(Math.random() * 1000) + 1 };
};

// Certificate generation function
const generateCertificate = async (volunteerData) => {
  try {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Background color
    doc.setFillColor(240, 248, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Border
    doc.setDrawColor(0, 100, 200);
    doc.setLineWidth(3);
    doc.rect(15, 15, pageWidth - 30, pageHeight - 30);

    // Title
    doc.setFontSize(36);
    doc.setTextColor(0, 100, 200);
    doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICATE OF APPRECIATION', pageWidth / 2, 50, { align: 'center' });

    // Subtitle
    doc.setFontSize(18);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('This is to certify that', pageWidth / 2, 70, { align: 'center' });

    // Volunteer name
    doc.setFontSize(28);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(volunteerData.volunteerName, pageWidth / 2, 100, { align: 'center' });

    // Activity description
    doc.setFontSize(16);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    const activityText = `has successfully completed volunteer work for "${volunteerData.activityTitle}"`;
    doc.text(activityText, pageWidth / 2, 120, { align: 'center' });

    // Organization details
    doc.setFontSize(14);
    doc.text(`Organization: ${volunteerData.ngoName}`, pageWidth / 2, 140, { align: 'center' });
    doc.text(`Location: ${volunteerData.location}`, pageWidth / 2, 155, { align: 'center' });
    doc.text(`Date: ${volunteerData.completionDate}`, pageWidth / 2, 170, { align: 'center' });

    // Impact statement
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text('Thank you for making a positive impact in your community!', pageWidth / 2, 190, { align: 'center' });

    // Signature line
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('CommuBot Volunteer Platform', pageWidth / 2, 220, { align: 'center' });

    // Certificate ID
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`Certificate ID: ${volunteerData.certificateId}`, pageWidth / 2, 240, { align: 'center' });

    return doc.output('datauristring');
  } catch (error) {
    console.error('Error generating certificate:', error);
    throw error;
  }
};

// Function to mark volunteer work as completed
const markVolunteerWorkCompleted = async (userId, opportunityId, volunteerName) => {
  const opportunity = volunteerOpportunities.find(opp => opp.id === opportunityId);
  if (!opportunity) {
    throw new Error('Opportunity not found');
  }

  const completionData = {
    userId,
    opportunityId,
    volunteerName,
    activityTitle: opportunity.title,
    ngoName: opportunity.ngo_name,
    location: opportunity.location,
    completionDate: new Date().toLocaleDateString(),
    certificateId: `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  };

  completedVolunteerWork.set(completionData.certificateId, completionData);
  return completionData;
};

// Enhanced slash command handler with immediate opportunity display
app.command('/volunteer', async ({ command, ack, respond, client }) => {
  await ack();

  try {
    const userInput = command.text; // e.g., "5 people, environmental cleanup, next Friday"
    const parsed = parseVolunteerRequest(userInput);

    // Debug logging (remove in production)
    console.log('Parsed request:', {
      original: userInput,
      teamSize: parsed.teamSize,
      activity: parsed.activity,
      timing: parsed.timing
    });

    // Add user context to parsed data
    parsed.userId = command.user_id;

    // Save volunteer request to database
    const requestData = {
      slack_user_id: command.user_id,
      team_size: parsed.teamSize,
      activity_type: parsed.activity,
      preferred_timing: parsed.timing,
      status: 'pending'
    };

    const savedRequest = await saveRequest(requestData);

    // Find matching opportunities immediately
    const matches = await findMatches(parsed);

    // Create interactive blocks response with booking buttons
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🤝 Volunteer Opportunities Found"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Your Request:*\n• Team Size: ${parsed.teamSize} people\n• Activity: ${parsed.activity}\n• When: ${parsed.timing}\n\n*Found ${matches.length} matching opportunities:*`
        }
      }
    ];

    if (matches.length > 0) {
      // Add each opportunity as a section with booking button (show up to 5 options)
      matches.slice(0, 5).forEach((opp, index) => {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${index + 1}. ${opp.title}*\n🏢 ${opp.ngo_name}\n📍 ${opp.location}\n📅 ${opp.time_slot}\n👥 Max ${opp.max_participants} volunteers\n📝 ${opp.description}`
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: `Book ${index + 1}`
            },
            action_id: "book_opportunity",
            value: `${savedRequest.id}_${opp.id}`,
            style: "primary"
          }
        });
      });

      // Add a "Show More" button if there are more than 5 matches
      if (matches.length > 5) {
        blocks.push({
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: `Show All ${matches.length} Opportunities`
              },
              action_id: "show_all_opportunities",
              value: JSON.stringify({
                requestId: savedRequest.id,
                allMatches: matches
              })
            }
          ]
        });
      }
    } else {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "😔 No specific matches found, but here are some general opportunities:"
        }
      });
    }

    // Try to send blocks first, fallback to text if it fails
    try {
      await respond({
        blocks: blocks
      });
    } catch (blocksError) {
      console.error('Error sending blocks, falling back to text:', blocksError);

      // Fallback to simple text response
      let responseText = `🤝 *Volunteer Request Parsed*\n\n*Team Size:* ${parsed.teamSize} people\n*Activity:* ${parsed.activity}\n*When:* ${parsed.timing}\n\n🎯 *Found ${matches.length} matching opportunities:*\n\n`;

      if (matches.length > 0) {
        const opportunityDetails = matches.slice(0, 5).map((opp, index) =>
          `${index + 1}. *${opp.title}* - ${opp.ngo_name}\n   📍 ${opp.location} | 📅 ${opp.time_slot} | 👥 Max ${opp.max_participants}\n   📧 ${opp.contact_email}\n   📝 ${opp.description}`
        ).join('\n\n');

        responseText += `*Opportunity Details:*\n${opportunityDetails}`;

        if (matches.length > 5) {
          responseText += `\n\n*Note:* Showing first 5 of ${matches.length} opportunities. Use the command again to see more!`;
        }
      } else {
        responseText += "😔 No specific matches found. Try adjusting your search criteria.";
      }

      await respond({
        text: responseText
      });
    }

  } catch (error) {
    console.error('Error in /volunteer command:', error);
    await respond({
      text: "Sorry, there was an error processing your request. Please try again."
    });
  }
});

// Simple demo booking handler - just shows confirmation
app.action('book_opportunity', async ({ body, ack, respond }) => {
  console.log('=== DEMO BOOKING ACTION TRIGGERED ===');

  await ack();

  try {
    const value = body.actions[0].value;
    const [requestId, opportunityId] = value.split('_');

    // Find opportunity details from our array
    const opportunity = volunteerOpportunities.find(opp => opp.id === parseInt(opportunityId));

    if (!opportunity) {
      await respond({
        text: "Sorry, this opportunity is no longer available.",
        replace_original: true
      });
      return;
    }

    const dateStr = opportunity.date_available ? new Date(opportunity.date_available).toLocaleDateString() : 'TBD';

    // Simple demo confirmation message
    const confirmationText = `✅ *DEMO: Opportunity Booked Successfully!*\n\n🎯 *${opportunity.title}*\n🏢 *Organization:* ${opportunity.ngo_name}\n📍 *Location:* ${opportunity.location}\n📅 *Date & Time:* ${dateStr} (${opportunity.time_slot})\n👥 *Capacity:* Up to ${opportunity.max_participants} volunteers\n📝 *What You'll Be Doing:* ${opportunity.description}\n📧 *Contact:* ${opportunity.contact_email}\n\n🎉 *This is a demo! In a real app, you would receive confirmation emails and the NGO would contact you.*\n\n💡 *Next Steps:*\n• Wait for NGO confirmation email\n• Prepare for the volunteer activity\n• Show up on time and make a difference! 🌟`;

    await respond({
      text: confirmationText,
      replace_original: true
    });

  } catch (error) {
    console.error('Error in demo booking:', error);
    await respond({
      text: "Sorry, there was an error booking the opportunity. Please try again.",
      replace_original: true
    });
  }
});

// Demo calendar handler
app.action('add_to_calendar', async ({ body, ack, respond }) => {
  await ack();

  try {
    const { title, date, time, location } = JSON.parse(body.actions[0].value);

    await respond({
      text: `📅 *DEMO: Calendar Event Created*\n\n*Event:* ${title}\n*Date:* ${date}\n*Time:* ${time}\n*Location:* ${location}\n\n✅ *This is a demo! In a real app, this would add the event to your calendar.*`,
      replace_original: true
    });
  } catch (error) {
    console.error('Error in demo calendar action:', error);
    await respond({
      text: "Sorry, there was an error adding to calendar. Please try again.",
      replace_original: true
    });
  }
});

// Demo contact NGO handler
app.action('contact_ngo', async ({ body, ack, respond }) => {
  await ack();

  try {
    const { email, ngo } = JSON.parse(body.actions[0].value);

    await respond({
      text: `📧 *DEMO: Contact Information*\n\n*Organization:* ${ngo}\n*Email:* ${email}\n\n💡 *This is a demo! In a real app, you would:*\n• Receive pre-filled email templates\n• Get direct contact forms\n• See real-time availability\n• Get instant responses from NGOs\n\n*For now, you can contact them directly at the email above.*`,
      replace_original: true
    });
  } catch (error) {
    console.error('Error in demo contact action:', error);
    await respond({
      text: "Sorry, there was an error getting contact information. Please try again.",
      replace_original: true
    });
  }
});

// Search again handler
app.action('search_again', async ({ ack, respond }) => {
  await ack();

  await respond({
    text: "Use `/volunteer` command again to search for new opportunities!",
    replace_original: true
  });
});

// Show all opportunities handler
app.action('show_all_opportunities', async ({ body, ack, respond }) => {
  await ack();

  try {
    const { allMatches } = JSON.parse(body.actions[0].value);

    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🎯 All ${allMatches.length} Opportunities`
        }
      }
    ];

    // Show all opportunities
    allMatches.forEach((opp, index) => {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${index + 1}. ${opp.title}*\n🏢 ${opp.ngo_name}\n📍 ${opp.location}\n📅 ${opp.time_slot}\n👥 Max ${opp.max_participants} volunteers\n📝 ${opp.description}`
        },
        accessory: {
          type: "button",
          text: {
            type: "plain_text",
            text: `Book ${index + 1}`
          },
          action_id: "book_opportunity",
          value: `${Date.now()}_${opp.id}`, // Generate new request ID
          style: "primary"
        }
      });
    });

    await respond({
      blocks: blocks,
      replace_original: true
    });

  } catch (error) {
    console.error('Error in show_all_opportunities action:', error);
    await respond({
      text: "Sorry, there was an error showing all opportunities. Please try again.",
      replace_original: true
    });
  }
});

// Handler functions for direct action handling
const handleBookOpportunity = async (body, res) => {
  try {
    const value = body.actions[0].value;
    const [requestId, opportunityId] = value.split('_');

    // Find opportunity details from our array
    const opportunity = volunteerOpportunities.find(opp => opp.id === parseInt(opportunityId));

    if (!opportunity) {
      res.json({
        text: "Sorry, this opportunity is no longer available.",
        replace_original: true
      });
      return;
    }

    const dateStr = opportunity.date_available ? new Date(opportunity.date_available).toLocaleDateString() : 'TBD';

    // Simple demo confirmation message
    const confirmationText = `✅ *DEMO: Opportunity Booked Successfully!*\n\n🎯 *${opportunity.title}*\n🏢 *Organization:* ${opportunity.ngo_name}\n📍 *Location:* ${opportunity.location}\n📅 *Date & Time:* ${dateStr} (${opportunity.time_slot})\n👥 *Capacity:* Up to ${opportunity.max_participants} volunteers\n📝 *What You'll Be Doing:* ${opportunity.description}\n📧 *Contact:* ${opportunity.contact_email}\n\n🎉 *This is a demo! In a real app, you would receive confirmation emails and the NGO would contact you.*\n\n💡 *Next Steps:*\n• Wait for NGO confirmation email\n• Prepare for the volunteer activity\n• Show up on time and make a difference! 🌟`;

    res.json({
      text: confirmationText,
      replace_original: true
    });

  } catch (error) {
    console.error('Error in demo booking:', error);
    res.json({
      text: "Sorry, there was an error booking the opportunity. Please try again.",
      replace_original: true
    });
  }
};

const handleMarkCompleted = async (body, res) => {
  try {
    const { opportunityId } = JSON.parse(body.actions[0].value);
    
    // Find opportunity details
    const opportunity = volunteerOpportunities.find(opp => opp.id === opportunityId);
    
    if (!opportunity) {
      res.json({
        text: "Opportunity not found.",
        replace_original: true
      });
      return;
    }

    // Simple demo completion message
    const completionText = `🎉 *DEMO: Volunteer Work Completed!*\n\n✅ *Congratulations!*\n\nYou have successfully completed your volunteer work for:\n*${opportunity.title}*\n\n🏢 *Organization:* ${opportunity.ngo_name}\n📍 *Location:* ${opportunity.location}\n📅 *Completion Date:* ${new Date().toLocaleDateString()}\n🆔 *Certificate ID:* CERT-DEMO-${Date.now()}\n\n🌟 *Thank you for making a positive impact in your community!*\n\n*This is a demo! In a real app, you would receive a professional certificate PDF.*\n\n💡 *Keep up the amazing work and continue volunteering!*`;

    res.json({
      text: completionText,
      replace_original: true
    });

  } catch (error) {
    console.error('Error in demo completion:', error);
    res.json({
      text: "Sorry, there was an error marking your volunteer work as completed. Please try again.",
      replace_original: true
    });
  }
};

const handleAddToCalendar = async (body, res) => {
  try {
    const { title, date, time, location } = JSON.parse(body.actions[0].value);

    res.json({
      text: `📅 *DEMO: Calendar Event Created*\n\n*Event:* ${title}\n*Date:* ${date}\n*Time:* ${time}\n*Location:* ${location}\n\n✅ *This is a demo! In a real app, this would add the event to your calendar.*`,
      replace_original: true
    });
  } catch (error) {
    console.error('Error in demo calendar action:', error);
    res.json({
      text: "Sorry, there was an error adding to calendar. Please try again.",
      replace_original: true
    });
  }
};

const handleContactNGO = async (body, res) => {
  try {
    const { email, ngo } = JSON.parse(body.actions[0].value);

    res.json({
      text: `📧 *DEMO: Contact Information*\n\n*Organization:* ${ngo}\n*Email:* ${email}\n\n💡 *This is a demo! In a real app, you would:*\n• Receive pre-filled email templates\n• Get direct contact forms\n• See real-time availability\n• Get instant responses from NGOs\n\n*For now, you can contact them directly at the email above.*`,
      replace_original: true
    });
  } catch (error) {
    console.error('Error in demo contact action:', error);
    res.json({
      text: "Sorry, there was an error getting contact information. Please try again.",
      replace_original: true
    });
  }
};

const handleSearchAgain = async (body, res) => {
  res.json({
    text: "Use `/volunteer` command again to search for new opportunities!",
    replace_original: true
  });
};

const handleShowAllOpportunities = async (body, res) => {
  try {
    const { allMatches } = JSON.parse(body.actions[0].value);
    
    let responseText = `🎯 *All ${allMatches.length} Opportunities*\n\n`;
    
    allMatches.forEach((opp, index) => {
      responseText += `${index + 1}. *${opp.title}* - ${opp.ngo_name}\n   📍 ${opp.location} | 📅 ${opp.time_slot} | 👥 Max ${opp.max_participants}\n   📧 ${opp.contact_email}\n   📝 ${opp.description}\n\n`;
    });

    res.json({
      text: responseText,
      replace_original: true
    });

  } catch (error) {
    console.error('Error in show_all_opportunities action:', error);
    res.json({
      text: "Sorry, there was an error showing all opportunities. Please try again.",
      replace_original: true
    });
  }
};

// Simple demo completion handler
app.action('mark_completed', async ({ body, ack, respond }) => {
  await ack();

  try {
    const { opportunityId } = JSON.parse(body.actions[0].value);
    
    // Find opportunity details
    const opportunity = volunteerOpportunities.find(opp => opp.id === opportunityId);
    
    if (!opportunity) {
      await respond({
        text: "Opportunity not found.",
        replace_original: true
      });
      return;
    }

    // Simple demo completion message
    const completionText = `🎉 *DEMO: Volunteer Work Completed!*\n\n✅ *Congratulations!*\n\nYou have successfully completed your volunteer work for:\n*${opportunity.title}*\n\n🏢 *Organization:* ${opportunity.ngo_name}\n📍 *Location:* ${opportunity.location}\n📅 *Completion Date:* ${new Date().toLocaleDateString()}\n🆔 *Certificate ID:* CERT-DEMO-${Date.now()}\n\n🌟 *Thank you for making a positive impact in your community!*\n\n*This is a demo! In a real app, you would receive a professional certificate PDF.*\n\n💡 *Keep up the amazing work and continue volunteering!*`;

    await respond({
      text: completionText,
      replace_original: true
    });

  } catch (error) {
    console.error('Error in demo completion:', error);
    await respond({
      text: "Sorry, there was an error marking your volunteer work as completed. Please try again.",
      replace_original: true
    });
  }
});

// Download certificate handler
app.action('download_certificate', async ({ body, ack, respond, client }) => {
  await ack();

  try {
    const certificateId = body.actions[0].value;
    const completionData = completedVolunteerWork.get(certificateId);

    if (!completionData) {
      await respond({
        text: "Certificate not found. Please contact support.",
        replace_original: true
      });
      return;
    }

    // Generate certificate again
    const certificateDataUri = await generateCertificate(completionData);

    // Convert data URI to buffer for file upload
    const base64Data = certificateDataUri.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    await client.files.upload({
      channels: body.user.id,
      file: buffer,
      filename: `volunteer_certificate_${certificateId}.pdf`,
      title: `Volunteer Certificate - ${completionData.activityTitle}`,
      initial_comment: `📄 Here's your volunteer certificate for ${completionData.activityTitle}.`
    });

    await respond({
      text: "📄 Your certificate has been sent to your DMs!",
      replace_original: true
    });

  } catch (error) {
    console.error('Error in download_certificate action:', error);
    await respond({
      text: "Sorry, there was an error generating your certificate. Please try again.",
      replace_original: true
    });
  }
});

// Health check endpoint

expressApp.get('/', (req, res) => {
  res.json({
    status: 'CommuBot is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test endpoint for Slack events
expressApp.get('/slack/events', (req, res) => {
  res.json({
    message: 'Slack events endpoint is ready',
    method: 'Use POST for actual events',
    timestamp: new Date().toISOString()
  });
});

// Manual challenge verification handler
expressApp.post('/slack/events', (req, res) => {
  console.log('=== Slack Events Endpoint Hit ===');
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // Handle URL verification challenge
  if (req.body && req.body.type === 'url_verification') {
    console.log('✅ URL verification challenge received:', req.body.challenge);
    res.status(200).json({ challenge: req.body.challenge });
    return;
  }

  // Handle other events using ExpressReceiver
  console.log('📨 Processing event type:', req.body?.type);
  receiver.requestHandler(req, res);
});

// Manual slash command handler
expressApp.post('/slack/commands', (req, res) => {
  console.log('=== Slash Command Endpoint Hit ===');
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  try {
    // Handle slash command using the app
    console.log('Calling receiver.requestHandler...');
    receiver.requestHandler(req, res);
    console.log('receiver.requestHandler completed');
  } catch (error) {
    console.error('❌ Error in slash command:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
      stack: error.stack
    });
  }
});

// Interactive components handler - direct action handling
expressApp.post('/slack/interactive', async (req, res) => {
  console.log('=== Interactive Components POST Endpoint Hit ===');
  console.log('Method:', req.method);
  console.log('Raw body:', req.body);

  try {
    // Parse the Slack payload
    let payload;
    if (req.body.payload) {
      payload = JSON.parse(req.body.payload);
      console.log('Parsed payload:', JSON.stringify(payload, null, 2));
    } else {
      console.log('No payload found');
      res.status(400).json({ error: 'No payload found' });
      return;
    }

    // Handle the action directly
    if (payload.type === 'block_actions' && payload.actions && payload.actions.length > 0) {
      const action = payload.actions[0];
      console.log('Processing action:', action.action_id, 'with value:', action.value);

      // Create a mock body object for our action handlers
      const mockBody = {
        actions: [action],
        user: payload.user,
        team: payload.team,
        channel: payload.channel
      };

      // Create a mock response object
      const mockRes = {
        status: (code) => ({ json: (data) => res.status(code).json(data) }),
        json: (data) => res.json(data)
      };

      // Handle different action types
      if (action.action_id === 'book_opportunity') {
        console.log('Handling book_opportunity action');
        await handleBookOpportunity(mockBody, mockRes);
      } else if (action.action_id === 'mark_completed') {
        console.log('Handling mark_completed action');
        await handleMarkCompleted(mockBody, mockRes);
      } else if (action.action_id === 'add_to_calendar') {
        console.log('Handling add_to_calendar action');
        await handleAddToCalendar(mockBody, mockRes);
      } else if (action.action_id === 'contact_ngo') {
        console.log('Handling contact_ngo action');
        await handleContactNGO(mockBody, mockRes);
      } else if (action.action_id === 'search_again') {
        console.log('Handling search_again action');
        await handleSearchAgain(mockBody, mockRes);
      } else if (action.action_id === 'show_all_opportunities') {
        console.log('Handling show_all_opportunities action');
        await handleShowAllOpportunities(mockBody, mockRes);
      } else {
        console.log('Unknown action:', action.action_id);
        res.json({ text: 'Unknown action' });
      }
    } else {
      console.log('Not a block_actions event');
      res.json({ text: 'Not a block_actions event' });
    }

  } catch (error) {
    console.error('❌ Error in interactive components:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
      stack: error.stack
    });
  }
});

// Also handle GET requests for testing
expressApp.get('/slack/interactive', (req, res) => {
  res.json({
    message: 'Slack interactive components endpoint is ready',
    method: 'Use POST for actual interactive components',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to test routing
expressApp.get('/slack/commands', (req, res) => {
  res.json({
    message: 'Slack commands endpoint is ready',
    method: 'Use POST for actual commands',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify the app is working
expressApp.get('/test', (req, res) => {
  res.json({
    status: 'CommuBot is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      slash_commands: '/slack/commands',
      interactive_components: '/slack/interactive',
      events: '/slack/events'
    }
  });
});

// Export the Express app for Vercel
module.exports = expressApp;
