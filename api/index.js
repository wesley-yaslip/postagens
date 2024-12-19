const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const app = express();
app.use(express.json());

// Serve static files from the "posts" directory
app.use('/posts', express.static(path.join(__dirname, '../posts')));

let posts = [];
let categories = ["uncategorized"];

// Load existing posts from the "posts" directory
function loadPosts() {
    const postFiles = fs.readdirSync(path.join(__dirname, '../posts'));
    postFiles.forEach(file => {
        const postId = file.split('-')[1].split('.')[0];
        const postHtml = fs.readFileSync(path.join(__dirname, '../posts', file), 'utf-8');
        const titleMatch = postHtml.match(/<h1>(.*?)<\/h1>/);
        const contentMatch = postHtml.match(/<p>(.*?)<\/p>/);
        const seoTitleMatch = postHtml.match(/<title>(.*?)<\/title>/);
        const seoDescriptionMatch = postHtml.match(/<meta name="description" content="(.*?)">/);
        const seoKeywordsMatch = postHtml.match(/<meta name="keywords" content="(.*?)">/);

        const post = {
            id: postId,
            title: titleMatch ? titleMatch[1] : '',
            content: contentMatch ? contentMatch[1] : '',
            seo: {
                title: seoTitleMatch ? seoTitleMatch[1] : '',
                description: seoDescriptionMatch ? seoDescriptionMatch[1] : '',
                keywords: seoKeywordsMatch ? seoKeywordsMatch[1] : ''
            },
            categories: ["uncategorized"]
        };
        posts.push(post);
    });
}

// Load posts on startup
loadPosts();

// Generate a random ID
function generateId() {
    return crypto.randomBytes(16).toString('hex');
}

// Function to sanitize title
function sanitizeTitle(title) {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9 ]/g, '') // Remove special characters
        .replace(/ /g, '-'); // Replace spaces with hyphens
}

// Rota para servir o arquivo HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Rota para servir o arquivo HTML de todas as postagens
app.get('/all-posts', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/all-posts.html'));
});

// Rota para criar uma nova postagem
app.post('/posts', (req, res) => {
    const { title, content, seoTitle, seoDescription, seoKeywords, categories: postCategories } = req.body;

    if (!title || !content || !seoTitle || !seoDescription || !seoKeywords || postCategories.length === 0) {
        return res.status(400).json({ message: "Todos os campos são obrigatórios." });
    }

    const newPost = { 
        id: generateId(), 
        title, 
        content, 
        seo: {
            title: seoTitle,
            description: seoDescription,
            keywords: seoKeywords
        },
        categories: postCategories.length ? postCategories : ["uncategorized"]
    };
    posts.push(newPost);

    // Save new categories
    postCategories.forEach(category => {
        if (!categories.includes(category)) {
            categories.push(category);
        }
    });

    // Create HTML file for the new post
    const fileName = sanitizeTitle(title);
    const postHtml = `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${seoTitle || title}</title>
        <meta name="description" content="${seoDescription}">
        <meta name="keywords" content="${seoKeywords}">
        <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body class="container mt-5">
        <h1>${title}</h1>
        <p>${content}</p>
        <p>Categorias: ${newPost.categories.join(', ')}</p>
        <a href="/" class="btn btn-secondary mt-4">Voltar</a>
    </body>
    </html>
    `;
    fs.writeFileSync(path.join(__dirname, '../posts', `${fileName}-${newPost.id}.html`), postHtml, 'utf8');

    res.status(201).json(newPost);
});

// Rota para listar todas as postagens com paginação
app.get('/posts', (req, res) => {
    const { page = 1, limit = 5 } = req.query;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedPosts = posts.slice(startIndex, endIndex);
    res.json(paginatedPosts);
});

// Rota para listar todas as postagens sem paginação
app.get('/all-posts-data', (req, res) => {
    res.json(posts);
});

// Rota para obter o conteúdo de uma postagem específica
app.get('/posts/:id/content', (req, res) => {
    const { id } = req.params;
    const post = posts.find(p => p.id == id);
    if (post) {
        res.json(post);
    } else {
        res.status(404).json({ message: 'Postagem não encontrada' });
    }
});

// Rota para editar uma postagem
app.put('/posts/:id', (req, res) => {
    const { id } = req.params;
    const { title, content, seoTitle, seoDescription, seoKeywords, categories: postCategories } = req.body;
    const post = posts.find(p => p.id == id);
    if (post) {
        const oldFileName = sanitizeTitle(post.title) + '-' + post.id;
        post.title = title;
        post.content = content;
        post.seo = {
            title: seoTitle,
            description: seoDescription,
            keywords: seoKeywords
        };
        post.categories = postCategories.length ? postCategories : ["uncategorized"];

        // Update HTML file for the edited post
        const newFileName = sanitizeTitle(title) + '-' + post.id;
        const postHtml = `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${seoTitle || title}</title>
            <meta name="description" content="${seoDescription}">
            <meta name="keywords" content="${seoKeywords}">
            <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body class="container mt-5">
            <h1>${title}</h1>
            <p>${content}</p>
            <p>Categorias: ${post.categories.join(', ')}</p>
            <a href="/" class="btn btn-secondary mt-4">Voltar</a>
        </body>
        </html>
        `;
        fs.writeFileSync(path.join(__dirname, '../posts', `${newFileName}.html`), postHtml, 'utf8');

        // Remove old file if the title has changed
        if (oldFileName !== newFileName) {
            fs.unlinkSync(path.join(__dirname, '../posts', `${oldFileName}.html`));
        }

        res.json(post);
    } else {
        res.status(404).json({ message: 'Postagem não encontrada' });
    }
});

// Rota para deletar uma postagem
app.delete('/posts/:id', (req, res) => {
    const { id } = req.params;
    const post = posts.find(p => p.id == id);
    if (post) {
        const fileName = sanitizeTitle(post.title) + '-' + post.id;
        posts = posts.filter(p => p.id != id);
        fs.unlinkSync(path.join(__dirname, '../posts', `${fileName}.html`));
        res.status(204).send();
    } else {
        res.status(404).json({ message: 'Postagem não encontrada' });
    }
});

// Rota para obter todas as categorias
app.get('/categories', (req, res) => {
    res.json(categories);
});

module.exports = app;
