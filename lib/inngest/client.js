import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "alliswell",  name: "ALL IS WELL",
    credentials: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
    },
  },
 });
