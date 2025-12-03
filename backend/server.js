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
// Substitua esta string pela sua própria URL de conexão do MongoDB
// (Ex: 'mongodb+srv://<username>:<password>@clustername.mongodb.net/stockbrasilDB')
const MONGODB_URI = 'mongodb+srv://stockbrasil:e.64iAG3JBv8KvU@stockbrasilcluster.ghth9gs.mongodb.net/?appName=StockBrasilCluster'; 

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Conectado ao MongoDB!'))
    .catch(err => console.error('❌ Erro na conexão com o MongoDB:', err));


const productSchema = new mongoose.Schema({
    nome: { type: String, required: true, unique: true, trim: true },
    categoria: { type: String, required: true },
    // Preço e Quantidade devem ser required e min 0
    preco: { type: Number, required: true, min: 0 },
    quantidade: { type: Number, required: true, min: 0 },

    // Custo e Mínimo são mais flexíveis, com default 0
    custo: { type: Number, default: 0, min: 0 },
    minimo: { type: Number, default: 0, min: 0 }, 
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
    // 💡 LOG DE ENTRADA: O que o Front-end enviou?
    console.log("-> DADOS RECEBIDOS DO FRONTEND:", req.body); 

    try {
        const newProduct = new Product(req.body); 
        await newProduct.save();

        // 💡 LOG DE SUCESSO: Se chegou aqui, o MongoDB salvou.
        console.log("<- PRODUTO SALVO COM SUCESSO. ID:", newProduct._id); 

        return res.status(201).json(newProduct); 
    } catch (error) {
        // ❌ LOG DE FALHA CRÍTICA: Captura e loga o objeto ERROR completo.
        console.error("❌ ERRO FATAL AO SALVAR PRODUTO:", error); 

        // Log específico para validação e duplicidade
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Falha de validação: Verifique os campos Preço e Quantidade.', details: error.message });
        }
        if (error.code === 11000) { // Duplicidade
            return res.status(400).json({ message: 'Erro: Produto com este nome já existe.' });
        }

        return res.status(500).json({ message: 'Erro interno do servidor ao salvar produto.' });
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