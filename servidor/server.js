const firebase = require('firebase');
const Rx = require('rxjs/Rx');

firebase.initializeApp({
  serviceAccount: "plataforma-robotica-f198a5fef1f0.json",
  databaseURL: "https://plataforma-robotica-7d010.firebaseio.com"
});

const ref = firebase.database().ref("programas");

const sp = require('serialport');

const serialPort = new sp('/dev/ttyACM0', {
  baudrate: 9600,
  parser: sp.parsers.readline('\n')
});

var observerAtual;

serialPort.on('data', (data) => {
  if ((data || '').trim() === 'p') { // pronto
    observerAtual.next(data);
    observerAtual.complete();
  } else {
    observerAtual.error('sem retorno');
  }
});

var index = -1;
const programas = {};
const logs = {};

function log(info) {
  return (data, i) => {
    logs[i] = (logs[i] || []).concat([[info, data]]);
    return data;
  }
}

obterProgramasFirebase()
  .map(snapshot => {
    const programa = snapshot.val().programa;
    logs[index + 1] = ['inicio'];
    index += programa.length;
    programas[index] = snapshot.key;
    return programa;
  })
  .concatMap((programa) => Rx.Observable.from(programa))
  .map(log('instrucao'))
  .map(obterInstrucaoArduino)
  .map(log('instrucaoArduino'))
  .concatMap(escreverSerial)
  .map((d, i) => {
    const key = programas[i];
    delete programas[i];
    return key;
  })
  .filter(key => key)
  .concatMap(removerProgramaFirebase)
  .subscribe();

function obterProgramasFirebase() {
  return new Rx.Observable(observer => {
    const next = observer.next.bind(observer);
    const error = observer.error.bind(observer);

    ref.on('child_added', next, error);
    return () => ref.off('child_added', next);
  });
}

function removerProgramaFirebase(key) {
  return new Rx.Observable(observer => {
    ref.child(key).remove(error => {
      if (error) {
        observer.error(error);
      } else {
        observer.next('ok');
        observer.complete();
      }
    });
  });
}

function escreverSerial(instrucao, i) {
  return new Rx.Observable(observer => {
    observerAtual = observer;

    instrucao.map(i => serialPort.write((i + ''), err => err && observer.error(err)));

    setTimeout(() => observer.error(`timeout - escreverSerial(${instrucao})`), 30000);

    return () => {
      console.log(logs[i]);
      delete logs[i];
    };
  });
}

function obterInstrucaoArduino(instrucao) {
  switch (instrucao[0]) {
    case 'girar_esquerda':
      return [2, '+', instrucao[1]];
    case 'girar_direita':
      return [2, '-', instrucao[1]];
    case 'abrir_pinca':
      return [4, '+', 30];
    case 'fechar_pinca':
      return [4, '-', 30];
    case 'mover_frente':
      return [8, '+', instrucao[1]];
    case 'mover_baixo':
      return [12, '-', instrucao[1]];
    case 'mover_tras':
      return [8, '-', instrucao[1]];
    case 'mover_cima':
      return [12, '+', instrucao[1]];
  }
}
