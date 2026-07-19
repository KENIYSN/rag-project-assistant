/**
 * /api/chat — Server-side RAG orchestration (Next.js API Route)
 *
 * Single `npm run dev` — no separate Express server needed.
 * API key stays server-side, never reaches the browser.
 */

import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const MODEL = "google/gemma-4-26b-a4b-it:free";

function buildSystemPrompt(chunks, fileContent, fileName) {
  const contextBlocks = chunks
    .map((chunk, i) => {
      const src = chunk.source_file || "unknown";
      const pg = chunk.page_number != null ? `, page ${chunk.page_number}` : "";
      const lec = chunk.lecture_number != null ? `, lecture ${chunk.lecture_number}` : "";
      return `[Source ${i + 1}: ${src}${pg}${lec}]\n${chunk.text}`;
    })
    .join("\n\n---\n\n");

  let fileBlock = "";
  if (fileContent) {
    fileBlock = `\n\n## UPLOADED FILE: ${fileName || "file"}\n${fileContent.slice(0, 8000)}`;
  }

  return `You are a precise, helpful university course assistant. Your role is to answer student questions EXCLUSIVELY based on the course material provided below.

## STRICT RULES
1. ONLY use information from the provided context passages to answer. Do NOT use your general knowledge.
2. If the context does not contain enough information to answer the question, clearly state: "I don't have enough information in the course materials to answer this question."
3. When answering, cite which source(s) you used (e.g., "According to Source 1…").
4. Keep your answers clear, well-structured, and academic in tone.
5. Use markdown formatting (headings, lists, bold, code blocks) to make your answers easy to read.
6. NEVER fabricate information. Accuracy is more important than completeness.

## COURSE CONTEXT
${contextBlocks || "(No context passages were retrieved for this question.)"}${fileBlock}`;
}

export async function POST(request) {
  try {
    const { question, fileContent, fileName } = await request.json();

    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: "Question is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Fetch context from Yassine's backend
    let chunks = [];
    let sources = [];

    try {
      const searchRes = await fetch(`${BACKEND_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question.trim(), top_k: 5 }),
      });

      if (searchRes.ok) {
        const data = await searchRes.json();
        chunks = data.results || [];
        sources = chunks.map((c) => ({
          source_file: c.source_file || "Unknown",
          page_number: c.page_number,
          lecture_number: c.lecture_number,
          score: c.score,
        }));
      }
    } catch (err) {
      console.warn(`⚠️  Backend unreachable: ${err.message}`);
    }

    // 2. Build RAG prompt
    const systemPrompt = buildSystemPrompt(chunks, fileContent, fileName);
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: question.trim() },
    ];

    // 3. Stream from OpenRouter
    const stream = await openrouter.chat.send({
      chatRequest: { model: "nvidia/nemotron-3-ultra-550b-a55b:free", messages, stream: true },
    });

    // 4. SSE response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          if (sources.length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`)
            );
          }

          for await (const chunk of stream) {
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "token", content })}\n\n`)
              );
            }
            
            // Usage information comes in the final chunk
            if (chunk.usage) {
              console.log("Reasoning tokens:", chunk.usage.completionTokensDetails?.reasoningTokens);
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
        } catch (streamError) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: streamError.message })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("❌ /api/chat error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
