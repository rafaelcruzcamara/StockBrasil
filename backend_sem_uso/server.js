// ==========================================================
// BACKEND: server.js
// ==========================================================
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Necessário para que o Front-end possa se comunicar com o Back-end

// 1. CONFIGURAÇÃO BÁSICA DO EXPRESS
const app = express();
const PORT = process.env.PORT || 3000; // O servidor rodará na porta 3000

// Middleware: Permite que o servidor entenda JSON
app.use(express.json());

// Middleware: Configuração de CORS para permitir requisições do seu Front-end
// O '*' permite acesso de qualquer origem, mas em produção, você deve especificar o endereço do seu Front-end.
app.use(cors());

// 2. CONEXÃO COM O BANCO DE DADOS (MongoDB)
// A sua URL de conexão atual (remova o appName e adicione o nome do DB)
const MONGODB_URI = 'mongodb+srv://stockbrasil:e.64iAG3JBv8KvU@stockbrasilcluster.ghth9gs.mongodb.net/stockbrasilDB?retryWrites=true&w=majority'; 

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Conectado ao MongoDB!'))
    .catch(err => console.error('❌ Erro na conexão com o MongoDB:', err));


const productSchema = new mongoose.Schema({
    nome: { type: String, required: true }, // Removi unique e trim para evitar erros agora
    categoria: { type: String, required: true },
    preco: { type: Number, required: true },
    quantidade: { type: Number, required: true },
    custo: { type: Number, default: 0 },
    minimo: { type: Number, default: 0 }, 
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

// 4. ROTAS DA API (CRUD de Produtos)

// Rota GET: Listar todos os produtos
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        return res.status(200).json(products);
    } catch (error) {
        console.error("Erro ao listar produtos:", error);
        return res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});


// Rota POST: Criar um novo produto
app.post('/api/products', async (req, res) => {
    console.log("-> DADOS RECEBIDOS (POST):", req.body); 

    try {
        const newProduct = new Product(req.body); 
        await newProduct.save(); // TENTA SALVAR NO MONGO
        
        console.log("<- SUCESSO: Produto salvo. ID:", newProduct._id); 
        return res.status(201).json(newProduct); 
    } catch (error) {
        // ❌ AQUI ESTÁ A CHAVE: Logamos o erro CRÍTICO que impede o salvamento
        console.error("❌ ERRO FATAL AO SALVAR PRODUTO:", error); 
        
        if (error.name === 'ValidationError') {
            // Se for erro de validação (campo required faltando)
            return res.status(400).json({ message: 'Falha de validação nos dados. Verifique todos os campos.', details: error.message });
        }
        
        // Erro genérico (ex: Falha na conexão com o Atlas)
        return res.status(500).json({ message: 'Erro interno do servidor: Falha de escrita no DB.' });
    }
});

// Rota DELETE: Excluir um produto por ID
app.delete('/api/products/:id', async (req, res) => {
    try {
        const result = await Product.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }
        return res.status(200).json({ message: 'Produto excluído com sucesso.' });
    } catch (error) {
        console.error("Erro ao excluir produto:", error);
        return res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Rota PUT/PATCH: Atualizar um produto por ID
app.patch('/api/products/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true } // 'new: true' retorna o documento atualizado
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }
        return res.status(200).json(updatedProduct);
    } catch (error) {
        console.error("Erro ao atualizar produto:", error);
        return res.status(400).json({ message: 'Dados inválidos ou erro ao atualizar.' });
    }
});


// 5. INICIALIZAÇÃO DO SERVIDOR
app.listen(PORT, () => {
    console.log(`🚀 Servidor StockBrasil rodando em http://localhost:${PORT}`);
    console.log(`Aguardando conexão do Front-end...`);
});

// Exporta o modelo para uso em outras partes se necessário
module.exports = { Product };