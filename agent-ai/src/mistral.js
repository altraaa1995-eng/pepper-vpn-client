const DEFAULT_BASE_URL = "https://api.mistral.ai/v1";

export class MistralClient {
  constructor({ apiKey, model = "mistral-large-latest", baseUrl = DEFAULT_BASE_URL } = {}) {
    if (!apiKey) throw new Error("MISTRAL_API_KEY is not set. Copy .env.example to .env and add your key.");
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async chat(messages, tools) {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const body = await res.json();
        detail = body.message ?? JSON.stringify(body).slice(0, 300);
      } catch {
        detail = res.statusText;
      }
      throw new Error(`Mistral API error ${res.status}: ${detail}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error("Mistral API returned no choices");
    return choice.message;
  }
}
