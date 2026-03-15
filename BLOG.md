# Building Lexie: How I Used Google's Gemini Live API and Vertex AI to Transform Legal Intake

*This post was created for the Google Gemini Live Agent Challenge. Follow along with #GeminiLiveAgentChallenge*

---

## The Problem That Kept Me Up at Night

Here's something most people don't know about personal injury law: **39.5 million people get injured every year in the US**, but only **400,000 actually file lawsuits**. That's just 1%.

What happens to the other 99%? They either handle claims themselves (getting 3.5x lower settlements on average) or get nothing at all.

Why? Because small plaintiff law firms - the ones representing everyday injured people - are drowning in manual work. A single case requires:
- 90-minute intake interviews
- 40-60 hours of document review
- 8-12 hours of damages calculation

At $2,350 in pre-settlement costs per case, firms can only afford to take cases with $100K+ settlement potential. The rest get turned away.

Meanwhile, large defense firms (representing corporations and insurance companies) are getting cutting-edge AI tools. The justice gap isn't just wide - **it's getting worse**.

So I built **Lexie** - an AI-powered legal intake assistant that conducts voice conversations, analyzes evidence, and calculates damages in real-time.

## Why Google's AI Stack Was Perfect for This

I've built projects on Google Cloud before, but this hackathon pushed me to explore tools I didn't know existed. Here's what I discovered:

### 1. Gemini Live API - Voice AI That Actually Works

Previously, I tried building real-time voice agents manually. It was a nightmare:
- Custom WebSocket servers
- Speech-to-text pipelines
- Text-to-speech synthesis
- Complex state management
- Interruption handling (the hardest part)

**With Gemini Live API and Google ADK's `Runner`?** I had a working voice agent in **under 15 minutes**.

Here's what blew my mind:

```python
# This is ALL you need for bidirectional voice streaming
runner = Runner(
    agent=live_agent,
    session_service=session_service
)

run_config = RunConfig(
    response_modalities=["AUDIO"],
    speech_config=SpeechConfig(voice="Puck"),
    input_audio_transcription=AudioTranscriptionConfig(),
    output_audio_transcription=AudioTranscriptionConfig()
)

async for event in runner.stream_live(
    user_id=client_id,
    session_id=session.id,
    live_request_queue=live_request_queue,
    run_config=run_config
):
    # Handle events: transcripts, audio, tool calls, interruptions
```

The abstraction is **incredible**. ADK handles:
- Bidirectional audio streaming (16kHz input, 24kHz output)
- Speech recognition and synthesis
- Interruption-aware turn management
- Tool orchestration
- Session state

### 2. Vertex AI RAG Engine - From 5 Services to 1

My old RAG pipeline looked like this:
```
Document AI → Manual chunking → ElasticSearch → Custom retrieval logic
```

**Vertex AI RAG Engine?** One managed service with:
- Built-in semantic search
- Grounded generation (cites sources to prevent hallucination)
- Automatic chunking and indexing
- Simple API

```python
# Upload document to RAG corpus
rag_service.upload_document(file_content, file_name)

# Query with grounded generation
result = rag_service.grounded_generate(
    prompt="Extract all medical expenses from this document",
    top_k=5
)
# → Returns: "$45,000 for ER visit (Source: medical_bill_2024.pdf, page 3)"
```

For legal tech, the source citation is **critical**. Attorneys need to verify every fact. Vertex AI's grounded generation does this automatically.

### 3. Gemini Vision API - Structured Data from Images

I needed to extract structured data from photos of medical bills, accident scenes, and injury documentation. Generic "describe this image" prompts didn't work well.

But **specific prompts with Gemini Vision**? Incredible results:

```python
prompt = """Analyze this medical bill image and extract:
- Provider name
- Service date
- Total amount
- Line items with costs
Return as JSON."""

result = vision_model.generate_content([prompt, image])
# → Returns structured JSON with all fields extracted
```

Vision API recognized:
- Text in medical bills (even handwritten amounts)
- Safety hazards in accident scene photos
- Injury severity in medical imaging

## The Multi-Agent Architecture

Here's where Google ADK really shined. I built a **three-agent system**:

1. **Root Agent (Lexie)** - Conducts voice conversation, orchestrates workflow
2. **Evidence Agent** - Analyzes documents using RAG + Vision
3. **Damages Agent** - Calculates settlement estimates using code execution

The agents don't talk to each other directly. Instead, they all read/write to a central **Evidence Hub** (singleton state manager). This prevents race conditions and makes debugging much easier.

```python
# Root Agent delegates to Evidence Agent
evidence_tool = AgentTool(agent=evidence_agent)

# Root Agent can call it like any other tool
root_agent = Agent(
    name="Lexie Live Agent",
    model="gemini-2.5-flash",
    tools=[
        evidence_tool,  # Sub-agent as a tool!
        update_case_facts,
        calculate_damages,
        # ... 17 tools total
    ]
)
```

When a user uploads a document:
1. Root Agent receives upload notification
2. Calls Evidence Agent (via `AgentTool`)
3. Evidence Agent uses RAG to extract facts
4. Evidence Agent saves results to Evidence Hub
5. Root Agent presents findings to user verbally
6. Frontend updates in real-time via WebSocket

All coordinated automatically by ADK. No explicit orchestration needed.

## The Hardest Technical Challenges

### Challenge 1: Audio Buffer Management

Gemini Live expects **16kHz PCM input** but returns **24kHz PCM output**. You can't just pipe audio through without conversion.

**Solution**: Convert on both ends:
```javascript
// Browser: Capture at 16kHz
const audioContext = new AudioContext({ sampleRate: 16000 });

// Server: Gemini returns 24kHz
// Send to frontend, let browser AudioContext handle playback
```

### Challenge 2: Interruption Handling

When users interrupt mid-sentence, you need to:
1. Detect the interrupt
2. Clear the audio queue
3. Stop current playback
4. Signal Gemini to stop talking
5. Handle stale transcript updates

**Solution**: Multi-layered system with turn counting:
```javascript
if (userSpeaking && agentSpeaking) {
    interruptedRef.current = true;
    audioQueue.length = 0;  // Clear buffered chunks
    currentSource?.stop();  // Stop playback
    userTurnCount++;  // Filter stale responses
}
```

I use a 1.5-second grace period after Gemini finishes speaking to prevent false interrupts from ambient noise.

### Challenge 3: Code Execution for Math

AI models hallucinate numbers. ChatGPT might calculate `$67,400 × 2.5 = $168,475` (wrong!).

**For legal tech, this is unacceptable.**

**Solution**: Custom code execution tool (inspired by novalyst pattern):
```python
def execute_python_code(code: str) -> dict:
    # Security: Block dangerous imports
    BLOCKED = [r'\bimport\s+subprocess\b', r'\bimport\s+os\b', ...]

    # Safe execution environment
    exec_globals = {
        '__builtins__': {
            'print': print, 'sum': sum, 'round': round,
            # ... math functions only
        }
    }

    exec(code, exec_globals, exec_locals)
    return {"output": captured_output, "variables": exec_locals}
```

Now the Damages Agent writes Python code for calculations, and I execute it in a sandbox. **Zero-error arithmetic**, every time.

## What I Learned About Building with Google AI

### 1. ADK's Abstraction is a Superpower

I can write **1000+ line agent instructions** without performance degradation. Tool calls complete in under 1 second. The `AgentTool` pattern for sub-agents is elegant and scales beautifully.

### 2. Grounded Generation is Essential

For legal tech, you can't hallucinate facts. Vertex AI's RAG engine prevents this by:
- Only using facts from uploaded documents
- Citing sources automatically
- Returning confidence scores

### 3. Specific Prompts Win

Generic prompts like "describe this image" don't work well. But:
```
"Extract all medical expenses from this bill and return as JSON"
```
Works incredibly well with Gemini Vision.

### 4. State Management is Everything

I learned the hard way: vague agent instructions lead to **tool spam** (calling the same tool repeatedly).

**Solution**: Set hard limits in instructions:
```
MAX 2 calls to analyze_document per upload.
If you need more information, ask the user.
```

And provide examples of good/bad behavior directly in the prompt.

## The Frontend: Real-Time Everything

Built with **Next.js 16** and **React 19**, the frontend updates progressively as data arrives:

- **Voice Chat**: Real-time transcripts and audio playback
- **Case Summary**: Facts populate as conversation flows
- **Timeline**: Events auto-sort chronologically
- **Evidence Hub**: Visual checklist with status tracking
- **Damages Calculator**: Settlement estimates with breakdown

All connected via WebSocket with deduplication logic to prevent duplicate entries.

The coolest part? **Tabs auto-open** when relevant data appears. Upload medical records → Medical tab opens automatically. Damages calculated → Damages tab appears with animated highlight.

## What's Next

I'm proud of what I built in this hackathon, but Lexie is just the beginning. Next steps:

- **Multilingual support** (Spanish for Hispanic plaintiffs)
- **Multi-party cases** (mass torts with multiple plaintiffs)
- **Attorney dashboard** (case queue management, analytics)
- **Deposition prep assistant** (generate question lists from evidence)
- **Settlement negotiation tools** (demand letter generation, counter-offer analysis)

The bigger vision? **Close the justice gap** by giving small plaintiff firms the same AI capabilities as large defense firms.

## Try It Yourself

Want to build something similar? Here's my advice:

1. **Start with ADK's quickstart** - Get a basic voice agent running first
2. **Use Vertex AI RAG** - Don't build custom RAG pipelines from scratch
3. **Design atomic tools** - Each tool should do ONE thing well
4. **Implement Evidence Hub pattern** - Single source of truth beats agent-to-agent communication
5. **Test interruption handling early** - It's harder than you think

## The Hackathon Experience

Building Lexie for the **Google Gemini Live Agent Challenge** pushed me to explore tools I didn't know existed. The time savings from using ADK and Vertex AI RAG let me focus on the actual legal workflow instead of infrastructure.

More importantly, I learned that **novel AI applications aren't just technically sophisticated** - they need to integrate seamlessly into real-world workflows. I spent significant time researching legal processes, watching deposition videos, and talking to friends in law to ensure Lexie solves actual problems.

That's what makes this project unique: it's not just cutting-edge AI, it's **AI that fits into lawyers' workflows**.

---

**Built with:**
- Google ADK (Agent Development Kit)
- Gemini 2.5 Flash & Gemini Live API
- Vertex AI RAG Engine
- Gemini Vision API
- Next.js 16, React 19, TypeScript
- FastAPI, Python 3.12

**Created for the Google Gemini Live Agent Challenge**
Follow along: #GeminiLiveAgentChallenge

---

What would you build with Gemini Live API? Drop a comment below!
