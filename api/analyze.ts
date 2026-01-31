import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenAI } from '@google/genai'

const SYSTEM_INSTRUCTION = `You are an expert Motion Graphics Designer and Senior React Engineer specializing in Remotion.dev.
Your goal is to deconstruct UI animations from video inputs into precise, technical specifications that can be directly used to write Remotion code.
You observe timing, easing, layout, and colors with pixel-perfect attention to detail.`

const ANALYSIS_PROMPT = `
Please analyze the attached UI animation for replication in Remotion.dev. I need a deep technical breakdown that covers the following **6 layers** to ensure the generated code is production-ready.

---

## 1. VISUAL SPECS (The Design System)

* **Colors**: Extract specific Hex codes for backgrounds, accents, text, and glows.
* **Typography**:
  - Font style (Serif/Sans-Serif/Monospace)
  - Approximated weights (400/500/600/700/800)
  - Letter spacing if notable (tight/normal/wide)
* **Layout**: Centered card, full-screen, split view, or stacked layout?
* **Assets**: Identify any SVGs, icons, images, or avatars needed.

---

## 2. VIDEO CONFIGURATION (The Canvas)

* **Dimensions**: (e.g., 1080x1080 Square, 1920x1080 Landscape, 1080x1920 Portrait)
* **FPS**: 30fps (default) or 60fps if smooth motion required
* **Duration**: Total frames AND seconds (e.g., "270 frames = 9 seconds @ 30fps")
* **Scene Breakdown**: List each distinct scene with frame ranges
  - Scene 1: Frame 0-90 (0-3s) - Description
  - Scene 2: Frame 90-165 (3-5.5s) - Description
  - etc.

---

## 3. DATA & PROPS (The Schema)

* **Static Text**: All text strings that appear (including small connecting words like "and", "or", "to")
* **Dynamic Props**: Elements that should be customizable via Zod schema
* **Assets**: Avatar URLs, icon references, image paths
* **Zod Schema Example**:
\`\`\`typescript
z.object({
  primaryText: z.string().default("Your"),
  secondaryText: z.string().default("Our"),
  // ... etc
})
\`\`\`

---

## 4. ANIMATION LOGIC (The Choreography)

For **EACH animated element**, provide:

### Element: [Name]
| Property | Value |
|----------|-------|
| **Start Frame** | e.g., Frame 20 |
| **End Frame** | e.g., Frame 45 |
| **Start Position** | e.g., "50px above target" or "off-screen left" |
| **End Position** | e.g., "directly above 'Our', left-aligned" |
| **Motion Type** | See categories below |
| **Fill Style** | Solid / Hollow (border-only) / Gradient |
| **Alignment** | Left / Center / Right relative to [reference] |

### Motion Type Categories (choose one):
- **Spring (Bouncy)**: Specify \`stiffness\` and \`damping\` (e.g., stiffness: 200, damping: 15)
- **Spring (Smooth)**: Lower stiffness, higher damping
- **Interpolate (Linear)**: Constant speed
- **Interpolate (Eased)**: Ease-in, ease-out, or ease-in-out
- **Breathing/Pulse**: Oscillating effect with \`amplitude\` and \`frequency\`
- **Rotation (Continuous)**: Degrees per frame, direction
- **Rotation (One-shot)**: Start angle → end angle
- **Static Glow**: No movement, only box-shadow/glow animation

### Positioning Keywords (be explicit):
- "directly above [element], left-aligned"
- "centered on screen"
- "replaces [element] at same position"
- "appears at top of screen" (absolute)
- "appears at end of line" (relative to another element)

---

## 5. SECONDARY ELEMENTS (Often Missed)

**List ALL elements**, including easily overlooked ones:

* [ ] Connecting text ("and", "or", "with", "to")
* [ ] Decorative lines (vertical separators, horizontal rules)
* [ ] Background glows or ambient effects
* [ ] Particles or floating elements
* [ ] Placeholder elements that fade out
* [ ] Markers, dots, or progress indicators
* [ ] Shadows or depth effects

For each secondary element:
- When does it appear? (frame)
- Where does it appear? (position)
- What happens to it? (fades out / stays / transforms)

---

## 6. THE REPLICATION PROMPT

Output a single, high-density prompt for AI coding assistants (Claude/Cursor).

**Must include**:
- React Functional Component structure
- Dependencies: \`remotion\`, \`zod\`, \`useCurrentFrame\`, \`useVideoConfig\`
- Animation utilities: \`spring\`, \`interpolate\`, \`Sequence\`, \`AbsoluteFill\`
- Complete Zod schema with defaults
- Frame-accurate timing for each animation
- Explicit positioning (not vague terms like "appears above")

**Prompt Structure**:
\`\`\`markdown
You are an expert Remotion developer. Create a React Functional Component for a video named \`[Name]\`.

**Dependencies**: remotion, zod

**Visual Style**:
- Background: [hex]
- Text: [hex], Font-weight [weight], Font-family: [family]
- Accents: [hex codes]

**Video Config**:
- Dimensions: [width]x[height]
- FPS: [fps]
- Duration: [frames] frames ([seconds] seconds)

**Props (Zod Schema)**:
[Complete schema with all props]

**Scene Breakdown**:

**Scene 1 (Frames X-Y): [Title]**
- Element A: [detailed animation spec]
- Element B: [detailed animation spec]
- Positioning: [explicit spatial relationships]

**Scene 2 (Frames X-Y): [Title]**
[... etc]

**Secondary Elements**:
- [List all small/decorative elements]

**Technical Requirements**:
- Use \`<Sequence>\` for scene division
- Use \`spring()\` with config: { stiffness: X, damping: Y } for [elements]
- Use \`interpolate()\` for [elements]
- Positioning must be pixel-accurate
- Include all secondary elements listed above
\`\`\`

---
`

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  starter: 30,
  pro: 150,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get auth token from header
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' })
  }

  const token = authHeader.split(' ')[1]

  // Initialize Supabase with service role for backend operations
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify the user's JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User profile not found' })
    }

    // Check and reset usage if period has passed
    const now = new Date()
    const resetAt = new Date(profile.period_reset_at)
    let currentUsage = profile.usage_count

    if (now >= resetAt) {
      // Reset usage
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      await supabase
        .from('users')
        .update({
          usage_count: 0,
          period_reset_at: nextReset.toISOString()
        })
        .eq('id', user.id)
      currentUsage = 0
    }

    // Check usage limit
    const limit = PLAN_LIMITS[profile.plan] || 3
    if (currentUsage >= limit) {
      return res.status(429).json({
        error: 'Usage limit exceeded',
        plan: profile.plan,
        usage: currentUsage,
        limit,
      })
    }

    // Parse request body
    const { videoUrl, storagePath } = req.body

    if (!videoUrl && !storagePath) {
      return res.status(400).json({ error: 'Missing videoUrl or storagePath' })
    }

    // Get video data
    let videoData: { base64: string; mimeType: string }

    if (storagePath) {
      // Download from Supabase Storage
      const { data: fileData, error: downloadError } = await supabase
        .storage
        .from('videos')
        .download(storagePath)

      if (downloadError || !fileData) {
        return res.status(400).json({ error: 'Failed to download video from storage' })
      }

      const buffer = await fileData.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mimeType = fileData.type || 'video/mp4'

      videoData = { base64, mimeType }
    } else {
      // Fetch from URL
      const response = await fetch(videoUrl)
      if (!response.ok) {
        return res.status(400).json({ error: 'Failed to fetch video from URL' })
      }

      const buffer = await response.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const mimeType = response.headers.get('content-type') || 'video/mp4'

      videoData = { base64, mimeType }
    }

    // Call Gemini API
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { text: ANALYSIS_PROMPT },
          {
            inlineData: {
              mimeType: videoData.mimeType,
              data: videoData.base64
            }
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
      }
    })

    const analysisResult = response.text || 'No analysis generated.'

    // Increment usage count
    await supabase
      .from('users')
      .update({ usage_count: currentUsage + 1 })
      .eq('id', user.id)

    // Save to analysis history (optional)
    await supabase
      .from('analysis_history')
      .insert({
        user_id: user.id,
        video_url: videoUrl || null,
        video_storage_path: storagePath || null,
        analysis_result: { text: analysisResult }
      })

    return res.status(200).json({
      result: analysisResult,
      usage: {
        current: currentUsage + 1,
        limit,
        plan: profile.plan
      }
    })

  } catch (error: any) {
    console.error('Analysis error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
