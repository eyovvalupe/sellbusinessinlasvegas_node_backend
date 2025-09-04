import express from "express";
import pkg1 from "body-parser";
import { createTransport } from "nodemailer";
import cors from "cors";
import mailchimp from "@mailchimp/mailchimp_marketing";
import FormData from "form-data"; // form-data v4.0.1
import Mailgun from "mailgun.js";
import dotenv from 'dotenv';

dotenv.config();

const { urlencoded, json } = pkg1;
const app = express();
app.use(cors());
app.use(urlencoded({ extended: true }));
app.use(json());

// ✅ Mailchimp config
mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER
});

const formatDate = (isoDate) => {
  // Convert to Date object
  const date = new Date(isoDate);

  // Format: DD.MM.YYYY
  const formatted =
    String(date.getDate()).padStart(2, "0") + "." +
    String(date.getMonth() + 1).padStart(2, "0") + "." +
    date.getFullYear();
  return formatted;
}

function generateTable(data) {
  if (!data || Object.keys(data).length === 0) return "<p>No data available</p>";

  const headers = Object.keys(data);
  const headerRow = headers.map(h => `<th>${h}</th>`).join("");
  const valueRow = headers.map(h => `<td>${data[h]}</td>`).join("");

  return `<table border="1" cellpadding="5" cellspacing="0">
            <thead><tr>${headerRow}</tr></thead>
            <tbody><tr>${valueRow}</tr></tbody>
          </table>`;
}

async function addListMember(username, email, listId) {
  try {
    const response = await mailchimp.lists.addListMember(listId, {
      email_address: email,
      status: "subscribed", // or "pending" if you require double opt-in
      merge_fields: {
        FNAME: username.split(" ")[0],
        LNAME: username.split(" ")[1]
      },
    });
  } catch (error) {
    console.error("Error adding subscriber:", error.response ? error.response.body : error);
  }
}

async function createCampaign(data, header, listId, type) {
  try {
    const campaign = await mailchimp.campaigns.create({
      type: "regular", // "regular", "plaintext", "absplit", "rss", "variate"
      recipients: {
        list_id: listId
      },
      settings: {
        subject_line: "Business Purchase Info",
        title: `${formatDate(data.timestamp)} ${type}`,
        from_name: data.username,
        reply_to: data.email
      }
    });

    const tableHTML = generateTable(data);

    const content = await mailchimp.campaigns.setContent(campaign.id, {
      html: `<h1>${header}</h1>${tableHTML}`
    });

  } catch (error) {
    console.error("Error creating campaign:", error.response ? error.response.body : error);
  }
}

async function sendMessage(inputData, header) {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY
    // When you have an EU-domain, you must specify the endpoint:
    // url: "https://api.eu.mailgun.net"
  });
  try {
    const data = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
      from: "Mailgun Sandbox <postmaster@sandboxa0bd0d9bb8e3494897fb14f4e9a2d1f6.mailgun.org>",
      to: ["Trent Lee <trentlee@trentlee.me>"],
      subject: header,
      text: JSON.stringify(inputData)
    });
  } catch (error) {
    console.log(error); //logs any error
  }
}
// ✅ Route to handle form
app.post("/listings", async (req, res) => {
  try {
    await sendMessage(req.body, "Small Business Deal Analyzer");
    await addListMember(req.body.username, req.body.email, process.env.LISTING_PIPELINE_ID);
    await createCampaign(req.body, "Small Business Deal Analyzer", process.env.LISTING_PIPELINE_ID, "Listing Pipeline");
    res.status(200).json({ message: "Submission successful. You will receive an email confirmation." });
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Error submitting form.");
  }
});

app.post("/buyers", async (req, res) => {
  try {
    await sendMessage(req.body, "Small Business Loan Purchase Price Calculator");
    await addListMember(req.body.username, req.body.email, process.env.BUYER_PIPELINE_ID);
    await createCampaign(req.body, "Small Business Loan Purchase Price Calculator", process.env.BUYER_PIPELINE_ID, "Buyer Pipeline");
    res.status(200).json({ message: "Submission successful. You will receive an email confirmation." });
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Error submitting form.");
  }
});

app.post("/sde", async (req, res) => {
  try {
    await sendMessage(req.body, "SDE Valuation Calculator");
    await addListMember(req.body.username, req.body.email, process.env.BUYER_PIPELINE_ID);
    await createCampaign(req.body, "SDE Valuation Calculator", process.env.BUYER_PIPELINE_ID, "Buyer Pipeline");
    res.status(200).json({ message: "Submission successful. You will receive an email confirmation." });
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Error submitting form.");
  }
});

// Run server
app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
