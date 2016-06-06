import {Firebase} from './firebase.service';
import {Usuario} from './usuario.service';

export class Editor {
  static $inject = ['Firebase', 'Usuario'];

  programas: AngularFireArray;

  constructor(private firebase: Firebase, private usuario: Usuario) {
    this.programas = firebase.loadArray(`programas`);
  }

  submeterPrograma(programa) {
    this.programas.$add({usuario: this.usuario.id, programa});
  }

  blocklyParser(workspace) {
    const blocks = workspace.getTopBlocks(true);

    if (!blocks.length) {
      throw 'Adicione uma ou mais operações no programa!';
    } else if (blocks.length > 1) {
      throw 'Todas as operações devem estar em um bloco só!';
    } else {
      return this.blockParser(blocks[0]);
    }
  }

  blockParser(block) {
    const child = block.childBlocks_.length && block.childBlocks_[0];
    return [PARSERS[block.type](block)].concat(child ? this.blockParser(child) : []);
  }
}

const PARSERS = {
  girar_esquerda: numberInput,
  girar_direita: numberInput,
  abrir_pinca: noInput,
  fechar_pinca: noInput,
  mover_frente: numberInput,
  mover_baixo: numberInput,
  mover_tras: numberInput,
  mover_cima: numberInput,
};

function noInput(block) {
  return [block.type];
}

function numberInput(block) {
  return [block.type, parseInt(block.inputList[0].fieldRow[1].text_)];
}