import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";

interface QuizItem {
  question: string;
  answer: string;
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  console.log('API route called');
  let body;
  try {
    body = await req.json();
    console.log('Received body:', body);
  } catch (error) {
    console.error('Error parsing request body:', error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { history, careerPath, calculateScore }: { history: QuizItem[], careerPath: string, calculateScore: boolean } = body;

  if (!careerPath) {
    console.error('No career path provided');
    return NextResponse.json({ error: "Career path is required" }, { status: 400 });
  }

  if (calculateScore) {
    // Generate career readiness score
    const scorePrompt = `Given the following quiz history for someone interested in becoming a ${careerPath}:
${history.map(item => `Q: ${item.question}\nA: ${item.answer}`).join('\n')}

Based on these responses and your knowledge of the software engineering field, calculate a career readiness score from 0 to 100. Provide a brief explanation for the score. Return your response in the following JSON format:
{
  "score": <number>,
  "explanation": "<brief explanation>"
}`;

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a career advisor specializing in software engineering. Evaluate the candidate's responses and provide a career readiness score along with a brief explanation."
          },
          {
            role: "user",
            content: scorePrompt,
          }
        ],
        model: "llama-3.2-11b-vision-preview",
        temperature: 0.5,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from Groq');
      }

      console.log('Groq score response:', content);
      const scoreData = JSON.parse(content);
      return NextResponse.json(scoreData);
    } catch (error) {
      console.error("Error generating score:", error);
      return NextResponse.json({ error: "Failed to calculate score" }, { status: 500 });
    }
  } else {
    // Generate questions (existing logic)
    const questionPrompt = `Given the following quiz history for someone interested in becoming a ${careerPath}:
${history.map(item => `Q: ${item.question}\nA: ${item.answer}`).join('\n')}

Generate exactly 7 new questions that build upon the previous questions and answers. Each question should assess the skill and level of the person becoming a ${careerPath}. The questions should focus on skills or knowledge relevant to becoming a ${careerPath}. Return only the questions, numbered from 1 to 7, without any additional text.`;

    try {
      console.log('Sending request to Groq');
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a helpful career advisor."
          },
          {
            role: "user",
            content: questionPrompt,
          }
        ],
        model: "llama-3.2-11b-vision-preview",
        temperature: 1.0,
      });

      console.log('Received response from Groq');
      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from Groq');
      }
      console.log('Groq response:', content);

      // Extract the 7 generated questions from the response
      const questions = content.split('\n').filter(line => line.trim() !== '').slice(0, 7);

      return NextResponse.json({ questions });
    } catch (error) {
      console.error("Error generating message:", error);
      return NextResponse.json({ error: "Failed to generate message" }, { status: 500 });
    }
  }
}
