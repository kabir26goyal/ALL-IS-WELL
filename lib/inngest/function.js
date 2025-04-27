import { db } from "@/lib/prisma";
import { inngest } from "./client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const generateIndustryInsights = inngest.createFunction(
  { name: "Generate Industry Insights" },
  { cron: "0 0 * * 0" }, // Run every Sunday at midnight
  async ({ event, step }) => {
    try {
      // Fetch all industries from the database
      const industries = await step.run("Fetch industries", async () => {
        return await db.industryInsight.findMany({
          select: { industry: true },
        });
      });

      // Iterate over each industry to generate insights
      for (const { industry } of industries) {
        const prompt = `
          Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format without any additional notes or explanations:
          {
            "salaryRanges": [
              { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
            ],
            "growthRate": number,
            "demandLevel": "High" | "Medium" | "Low",
            "topSkills": ["skill1", "skill2"],
            "marketOutlook": "Positive" | "Neutral" | "Negative",
            "keyTrends": ["trend1", "trend2"],
            "recommendedSkills": ["skill1", "skill2"]
          }

          IMPORTANT: Return ONLY the JSON. No additional text, notes, or markdown formatting.
          Include at least 5 common roles for salary ranges.
          Growth rate should be a percentage.
          Include at least 5 skills and trends.
        `;

        // Call the AI model to generate insights
        const res = await step.ai.wrap(
          "gemini",
          async (p) => {
            return await model.generateContent(p);
          },
          prompt
        );

        const text = res.response.candidates[0].content.parts[0].text || "";
        const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

        // Parse the generated JSON
        const insights = JSON.parse(cleanedText);

        // Ensure demandLevel and marketOutlook are in uppercase to match the Prisma schema enums
        insights.demandLevel = insights.demandLevel.toUpperCase(); // Ensures the enum is valid
        insights.marketOutlook = insights.marketOutlook.toUpperCase(); // Ensures the enum is valid

        // Update the database with the generated insights
        await step.run(`Update ${industry} insights`, async () => {
          await db.industryInsight.update({
            where: { industry },
            data: {
              ...insights,
              lastUpdated: new Date(),
              nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // next update in 7 days
            },
          });
        });
      }
    } catch (error) {
      console.error("Error generating or updating industry insights:", error);
      throw new Error("Failed to generate or update industry insights");
    }
  }
);
