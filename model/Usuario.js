const conexao = require("../config/database");
const { Schema, model } = require("mongoose");

const UsuarioSchema = new Schema({
  nome:      { type: String, required: true },
  email:     { type: String, required: true },
  senha:     { type: String, required: true },
  cpf:       { type: String, required: true },
  telefone:  { type: String, required: true },
  permissao: { type: String, required: true, default: "1",},
});

module.exports = model("Usuario", UsuarioSchema, "usuarios");