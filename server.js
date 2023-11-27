const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

// PLUGINS
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(express.json());

const corsOption = {
  origin : '*',
  //origin : ["http://localhost:8080"],
  optionSuccessStatus: 200
}
app.use(cors(corsOption));

const PORT = process.env.PORT || 3000;


app.post('/link-preview', async (req, res) => {
  const { url } = req.body;

  try {
    const baseUrl = calculateBaseUrl(url);
    if (!baseUrl) {
      throw new Error('Not valid url')
    }
    const previewData = await getLinkPreview(url, baseUrl);
    res.json(previewData);
  } catch (error) {
    console.error('Error fetching link preview:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

async function getLinkPreview(url, baseUrl) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    const title = getTitle($);
    const description = getDescription($);
    const image = getImage($, baseUrl);
    const domain = getDomain(url);

    return { title, description, image, domain, base: baseUrl, url };
  } catch (error) {
    throw new Error('Error fetching data from URL' + error.message);
  }
}

function getTitle($) {
  return $('head title').text() ||
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('h1').first().text() ||
    $('h2').first().text() ||
    null;
}

function getDescription($) {
  return $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="twitter:description"]').attr('content') ||
    null;
}

function getDomain(url) {
  try {
    const urlObject = new URL(url);
    return urlObject.hostname;
  } catch (error) {
    console.error('Error getting domain:', error.message);
    return null;
  }
}

function getImage($, baseUrl) {
  const getSrcFromMeta = (selector) => {
    const metaTag = $(selector);
    return metaTag.attr('content');
  };

  const getImageFromOpenGraph = () => getSrcFromMeta('meta[property="og:image"]');
  const getImageFromTwitter = () => getSrcFromMeta('meta[name="twitter:image"]');

  // Intentar obtener la imagen de diferentes fuentes en orden de prioridad
  const imageSources = [getImageFromOpenGraph, getImageFromTwitter];

  // Iterar sobre las fuentes hasta encontrar una URL de imagen no nula
  let imageUrl = null;
  for (const getImageFunction of imageSources) {
    imageUrl = getImageFunction();
    if (imageUrl !== null) {
      break;
    }
  }

  // Verificar si la URL de la imagen es relativa y convertirla en absoluta si es necesario
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = new URL(imageUrl, baseUrl).toString();
  }

  return imageUrl;
}

function calculateBaseUrl(url) {
  try {
    const urlObject = new URL(url);
    return `${urlObject.protocol}//${urlObject.hostname}${urlObject.port ? `:${urlObject.port}` : ''}`;
  } catch (error) {
    console.error('Error calculating base URL:', error.message);
    return null;
  }
}
