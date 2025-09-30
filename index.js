const express = require("express");
const app = express();
const path = require("path");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const conexao = require("./config/database");
const Usuario = require("./model/Usuario");
const Cliente = require("./model/Cliente"); 
require('dotenv').config();

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.get("/", function (req, res) {
  res.render("login.ejs", {});
});

app.post("/", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      return res.send(
        `<script>alert("Cadastro não encontrado."); window.history.back();</script>`
    );
  }

  const match = await bcrypt.compare(senha, usuario.senha);

    if (match) {
      req.session.id_usuario = usuario._id;
      req.session.email = usuario.email;
      req.session.permissao = usuario.permissao; 

      return res.redirect("/home");
    } else {
      return res.send(
        `<script>alert("E-mail ou senha incorretos."); window.history.back();</script>`
      );
    }
  } catch (error) {
    console.error("Erro ao consultar o banco de dados: ", error);
    return res.status(500).send(
      `<script>alert("Ocorreu um erro ao consultar o banco de dados."); window.history.back();</script>`
    );
  }
});

app.get("/login-cliente", function (req, res) {
  res.render("login-cliente.ejs", {});
});

app.post("/login-cliente", async (req, res) => {
  const { cpf} = req.body;

  try {
    const cliente = await Cliente.findOne({ cpf }); 

    if (!cliente) {
      return res.send(
        `<script>alert("CPF não encontrado. Por favor, cadastre-se no balcão de atendimento."); window.history.back();</script>`
    );
  }

    req.session.id_cliente = cliente._id;
    req.session.cpf_cliente = cliente.cpf;
    
    if (req.session.id_usuario) {
        delete req.session.id_usuario;
        delete req.session.permissao;
    }

  return res.redirect("/meus-cartoes");

  } catch (error) {
    console.error("Erro ao consultar o banco de dados: ", error);
    return res.status(500).send(
      `<script>alert("Ocorreu um erro ao consultar o banco de dados."); window.history.back();</script>`
    );
  }
});

app.get("/cadastro", function (req, res) {
  res.render("cadastro.ejs", {});
});

app.post('/cadastro', async function(req, res){
  try {
    const { nome, cpf, email, senha, telefone } = req.body;

    const usuarioExistente = await Usuario.findOne({ 
        $or: [{ email: email }, { cpf: cpf }] 
    });

    if (usuarioExistente) {
        let mensagemErro = 'Erro ao cadastrar: ';
        if (usuarioExistente.email === email) {
            mensagemErro += 'Este e-mail já está em uso.';
        } else {
            mensagemErro += 'Este CPF já está em uso.';
        }
        return res.send(`
            <script>
                alert('${mensagemErro}');
                window.history.back();
            </script>
        `);
    }

    // Verifica se já tem um usuário cadastrado no sistema. Se sim, permissão 1 (adm). Se não, permissão 2 (funcionario)
    const count = await Usuario.countDocuments();
    const permissao_inicial = count === 0 ? 1 : 2; 

    const hash = await bcrypt.hash(senha, saltRounds);

    const usuario = new Usuario({
      nome: nome,
      cpf: cpf,
      email: email,
      senha: hash,
      telefone: telefone,
      permissao: permissao_inicial
    });

    await usuario.save();
    res.send(`
      <script>
        alert('Usuário cadastrado com sucesso! Permissão: ${permissao_inicial}');
        window.location.href = "/";
      </script>
    `);
  } catch (err) {
    console.error("Erro ao salvar o usuário:", err);
    res.send(`<script>alert("Erro ao salvar o usuário: ${err.message}"); window.history.back();</script>`);
  }
});

app.get("/home", async function (req, res) {
  try {
      const id_usuario = req.session.id_usuario;
      const usuario = await Usuario.findById(req.session.id_usuario);

      if (!id_usuario) {
        return res.redirect("/");
      }

      res.render("home.ejs", { usuario });

  }catch (error) {
    console.error("Erro: ", error);
    res.status(500).send("Ocorreu um erro ao carregar a página.");
}
});

app.get("/perfil", async function (req, res) {
  try {
    const id_usuario = req.session.id_usuario;

    if (!id_usuario) {
      return res.redirect("/");
    }

    Usuario.findById(id_usuario).then(function (usuario) {
      if (!usuario) {
        return res.redirect("/");
      }
    res.render("perfil.ejs", { usuario });
    });

  } catch (error) {
    console.error("Erro: ", error);
    res.status(500).send("Ocorreu um erro ao carregar o perfil.");
  }
});

app.get('/deletar-usuario/:id', async function(req, res) {
  try {
    const id_usuario = req.session.id_usuario;

    if (!id_usuario) {
      return res.redirect("/");
    }

    await Usuario.findByIdAndDelete(req.params.id);

    res.send(`
      <script>
        alert('Usuário deletado com sucesso!');
        window.location.href = "/";
      </script>
    `);

  } catch (error) {
    console.error("Erro ao deletar o usuário:", error);
    res.send("<script>alert('Erro ao deletar o usuário: " + error + "'); window.history.back();</script>");
  }
});

app.post('/editar-usuario/:id', async function(req, res) {
  try {
    const usuarioExistente = await Usuario.findOne({ email: req.body.email });
    if (usuarioExistente && usuarioExistente._id.toString() !== req.params.id) {
      return res.send(`
        <script>
          alert('E-mail já cadastrado! Tente outro.');
          window.location.href = "/perfil";
        </script>
      `);
    }

    const usuarioAtual = await Usuario.findById(req.params.id);

    let senhaAtualizada = usuarioAtual.senha;

    if (req.body.senha && req.body.senha !== usuarioAtual.senha) {
      senhaAtualizada = await bcrypt.hash(req.body.senha, saltRounds);
    }

    await Usuario.findByIdAndUpdate(req.params.id, {
      nome: req.body.nome,
      email: req.body.email,
      telefone: req.body.telefone,
      senha: senhaAtualizada
    });

    res.send(`
      <script>
        alert('Usuário editado com sucesso!');
        window.location.href = "/perfil";
      </script>
    `);

  } catch (err) {
    res.send("<script>alert('Erro ao editar o usuário: " + err + "'); window.history.back();</script>");
  }
});

app.get("/cadastro-cliente", function (req, res) {
    if (!req.session.id_usuario) {
        return res.redirect("/");
    }
    res.render("cadastro-cliente.ejs", {});
});

app.post('/cadastro-cliente', async function(req, res){
    if (!req.session.id_usuario) {
        return res.send(
            `<script>alert("Sessão expirada. Faça login novamente."); window.location.href = "/";</script>`
        );
    }

  try {
    const { nome, cpf, email, telefone, endereco, nascimento } = req.body;
    
    const clienteExistente = await Cliente.findOne({ cpf });
    if (clienteExistente) {
        return res.send(`
            <script>
                alert('Erro: CPF ${cpf} já cadastrado no programa de fidelidade!');
                window.history.back();
            </script>
        `);
    }

    const novoCliente = new Cliente({
      nome,
      cpf,
      email,
      telefone,
      endereco,
      nascimento
    });

    await novoCliente.save();
    res.send(`
      <script>
        alert('Cliente ${nome} cadastrado com sucesso e saldo inicial de 0 pontos!');
        window.location.href = "/home";
      </script>
    `);
  } catch (err) {
    console.error("Erro ao salvar o cliente:", err);
    res.send(`<script>alert("Erro ao cadastrar o cliente: ${err.message}"); window.history.back();</script>`);
  }
});

app.get("/listar-clientes", async function (req, res) {
  try {
    const id_usuario = req.session.id_usuario;

    if (!id_usuario) {
      return res.redirect("/");
    }

    Cliente.find({}).then(function (docs) {
      res.render("clientes.ejs", { Clientes: docs });
    });
  } catch (error) {
    console.error("Erro: ", error);
    res.status(500).send("Ocorreu um erro ao carregar os clientes.");
  }
});

app.get("/meus-cartoes", (req, res) => {
    if (!req.session.id_cliente) {
        return res.redirect("/login-cliente");
    }

    const dadosDosCartoes = [
        {
            restaurante: "Restaurante Sabor Divino",
            promocao: "Junte 10 selos e ganhe uma sobremesa",
            registrosFeitos: 7,
            registrosTotais: 10,
            premio: "Sobremesa Especial"
        },
        {
            restaurante: "Pizzaria Forno a Lenha",
            promocao: "Complete o cartão e ganhe uma pizza broto",
            registrosFeitos: 3,
            registrosTotais: 8,
            premio: "Pizza Broto de Calabresa"
        },
        {
            restaurante: "Cafeteria Aconchego",
            promocao: "A cada 5 cafés, o 6º é por nossa conta!",
            registrosFeitos: 5,
            registrosTotais: 5,
            premio: "Um café expresso grátis"
        }
    ];

    res.render("meus-cartoes.ejs", {
        cards: dadosDosCartoes,
        paginaAtiva: 'cartoes' // Esta linha corrige o erro
    });
});

app.get("/promocoes", (req, res) => {
    if (!req.session.id_cliente) {
      return res.redirect("/login-cliente");
    }

    const dadosDasPromocoes = [
        {
            restaurante: "Restaurante Sabor Divino",
            titulo: "Sobremesa por nossa conta!",
            regras: "Junte 10 selos de refeições acima de R$30,00.",
            premio: "Uma sobremesa especial do chef.",
            validade: "31/12/2024"
        },
        {
            restaurante: "Pizzaria Forno a Lenha",
            titulo: "Amantes de Pizza",
            regras: "Na compra de 8 pizzas grandes, a 9ª (broto) é grátis.",
            premio: "Uma pizza broto de Calabresa ou Mussarela.",
            validade: "30/11/2024"
        },
        {
            restaurante: "Açai da Praça",
            titulo: "Fidelidade Gelada",
            regras: "Acumule 5 selos e ganhe um adicional.",
            premio: "Um adicional de Leite em Pó ou Paçoca.",
            validade: "Válido por 90 dias."
        }
    ];

    res.render("promocoes.ejs", {
        promocoes: dadosDasPromocoes,
        paginaAtiva: 'promocoes'
    });
});

app.get("/notificacoes", (req, res) => {
    if (!req.session.id_cliente) {
      return res.redirect("/login-cliente");
    }

    const dadosDasNotificacoes = [
        {
            icone: "bi-check-circle-fill text-success",
            mensagem: "Novo registro no seu cartão da <strong>Pizzaria Forno a Lenha</strong>.",
            tempo: "5 min atrás"
        },
        {
            icone: "bi-star-fill text-warning",
            mensagem: "Parabéns! Você completou seu cartão da <strong>Cafeteria Aconchego</strong> e pode resgatar seu prêmio.",
            tempo: "2 horas atrás"
        },
        {
            icone: "bi-megaphone-fill text-primary",
            mensagem: "O <strong>Restaurante Sabor Divino</strong> tem uma nova promoção. Confira!",
            tempo: "Ontem"
        },
        {
            icone: "bi-check-circle-fill text-success",
            mensagem: "Novo registro no seu cartão do <strong>Restaurante Sabor Divino</strong>.",
            tempo: "2 dias atrás"
        }
    ];

    res.render("notificacoes.ejs", {
        notificacoes: dadosDasNotificacoes,
        paginaAtiva: 'notificacoes'
    });
});

app.get("/perfil-cliente", (req, res) => {
    if (!req.session.id_cliente) {
      return res.redirect("/login-cliente");
    }

    const dadosDoUsuario = {
        nome: "Matheus da Silva",
        cpf: "123.456.789-00",
        email: "matheus@email.com",
        telefone: "(11) 98765-4321",
        fotoUrl: "https://placehold.co/150x150/EFEFEF/333333?text=MS" // Foto de exemplo
    };

    res.render("perfil-cliente.ejs", {
        usuario: dadosDoUsuario,
        paginaAtiva: 'perfil'
    });
});

app.get("/sair", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Erro ao finalizar a sessão:", err);
            return res.status(500).send(`<script>alert("Ocorreu um erro ao sair da conta."); window.history.back();</script>`);
        }
        res.redirect("/");
    });
});

app.get("/sair-cliente", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Erro ao finalizar a sessão:", err);
            return res.status(500).send(`<script>alert("Ocorreu um erro ao finalizar sua sessão."); window.history.back();</script>`);
        }
        res.redirect("/login-cliente");
    });
});

app.get("/sair", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Erro ao finalizar a sessão:", err);
      return res
        .status(500)
        .send(
          `<script>alert("Ocorreu um erro ao sair da conta."); window.history.back();</script>`
        );
    }
    res.redirect("/");
  });
});

app.listen("3000", function () {
  console.log("🚀 Servidor rodando na porta 3000!");
});