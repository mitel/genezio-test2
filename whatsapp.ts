import {GenezioDeploy, GenezioHttpRequest, GenezioHttpResponse, GenezioMethod} from "@genezio/types";
import axios from "axios";

@GenezioDeploy()
export class BackendService {
  GRAPH_API_TOKEN = process.env.GRAPH_API_TOKEN;
  WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
  BUSINESS_PHONE_NUMBER_ID = process.env.BUSINESS_PHONE_NUMBER_ID;

  constructor() {
    if (!this.GRAPH_API_TOKEN)
      throw new Error("GRAPH_API_TOKEN is required, get it from https://developers.facebook.com/docs/whatsapp/api/messages/#send-messages")

    if (!this.WEBHOOK_VERIFY_TOKEN)
      throw new Error("WEBHOOK_VERIFY_TOKEN is required, set it to any value you want")

    if (!this.BUSINESS_PHONE_NUMBER_ID)
      throw new Error("BUSINESS_PHONE_NUMBER_ID is required, get it from https://developers.facebook.com/docs/whatsapp/api/messages/#send-messages")
  }

  async #sendMessage(message: string, phone: string): Promise<boolean> {
    try {
      console.log("Sending message to", phone)
      await axios({
        method: "POST",
        url: `https://graph.facebook.com/v19.0/${this.BUSINESS_PHONE_NUMBER_ID}/messages`,
        headers: {
          Authorization: `Bearer ${this.GRAPH_API_TOKEN}`,
        },
        data: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone,
          type: "text",
          text: {
            preview_url: false,
            body: message
          }
        }
      })
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  @GenezioMethod({type: "http"})
  async webhook(request: GenezioHttpRequest): Promise<GenezioHttpResponse> {
    try {
      if (request.queryStringParameters !== undefined) {
        // Webhook verification by WhatsApp Business API
        const mode = request.queryStringParameters["hub.mode"];
        const token = request.queryStringParameters["hub.verify_token"];
        const challenge = request.queryStringParameters["hub.challenge"];
        if (mode === "subscribe" && token === this.WEBHOOK_VERIFY_TOKEN) {
          console.log("Webhook verified successfully!");
          return {
            headers: {"Content-Type": "application/json"},
            statusCode: "200",
            body: challenge
          }
        } else return {
          headers: {"Content-Type": "application/json"},
          statusCode: "403",
          body: "Forbidden"
        }
      }

      const body = request.body.entry[0].changes[0].value.messages[0].text.body; // Message received

      if (body === "ping") {
        console.log("Ping received")
        await this.#sendMessage("pong", request.body.entry[0].changes[0].value.messages[0].from)
        return {
          headers: {"Content-Type": "application/json"},
          statusCode: "200",
          body: "Message sent"
        }
      }

      return {
        headers: {"Content-Type": "application/json"},
        statusCode: "200",
        body: "Message not handled"
      }

    } catch (error) {
      console.error(error)
      return {
        headers: {"Content-Type": "application/json"},
        statusCode: "500",
        body: "Internal server error"
      }
    }
  }
}