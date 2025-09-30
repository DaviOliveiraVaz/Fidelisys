const conexao = require("../config/database");
const { Schema, model } = require("mongoose");

const ClienteSchema = new Schema({
  nome:      { type: String, required: true },
  email:     { type: String, required: true },
  cpf:       { type: String, required: true, unique: true },
  telefone:  { type: String, required: true },
  endereco:  { type: String, required: true },
  nascimento: { type: Date, required: true }, 
  pontos_acumulados: { type: Number, default: 0 } 
});

module.exports = model("Cliente", ClienteSchema, "clientes");