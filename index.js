'use strict';

const EventEmitter = require('events');
const util = require('util');
const io = require('socket.io');
const net = require('net');

function SocketServer(config, settings) {
  EventEmitter.call(this);

  const connections = {
    ws: [],
    tcp: [],
  };

  // setup sockets
  this.init = () => {
    this.emit('subscribe', {
      'create-ws': this.createWebSocket,
      'create-tcp': this.createTcp,
    });

    // setup any WebSockets
    if (config.wsPorts) config.wsPorts.forEach(this.createWebSocket);

    // setup any TCP sockets
    if (config.tcpPorts) config.tcpPorts.forEach(this.createTcp);
  };

  this.createWebSocket = (port) => {
    // port can be a port number or an instance of a server
    const server = new io();

    server.on('connection', (socket) => {
      this.emit('connect', socket);
      connections.ws.push(socket);

      // send the available events
      this.emit('get-events', socket);

      socket.on('message', (message) => {
        // if this is a system event we pass the socket for a callback
        if (typeof message === 'string') message = JSON.parse(message);
        if (settings.systemEvents.indexOf(message.type) === -1) this.emit(message.type, message.data);
        else this.emit(message.type, message.data, socket);
      });

      socket.on('disconnect', () => {
        this.emit('disconnect', socket);
        const index = connections.ws.indexOf(socket);
        if (index !== -1) connections.ws.splice(index, 1);
      });
    });

    // make sure we have a port to work with
    waitForSocket(server.listen(port));
  };

  const waitForSocket = (listener) => {
    // if we don't have the address yet, let's wait until we do
    if (listener.httpServer && listener.httpServer.address()) {
      this.emit('status', 'WebSocket listening on port:', listener.httpServer.address().port);
    } else {
      setTimeout(waitForSocket, 500, listener);
    }
  };

  this.createTcp = (port) => {
    const server = net.createServer((socket) => {
      this.emit('connect', socket);
      connections.tcp.push(socket);

      // send the available events
      this.emit('get-events', socket);

      socket.on('data', (data) => {
        const message = JSON.parse(data);
        // if this is a system event we pass the socket for a callback
        if (settings.systemEvents.indexOf(message.type) === -1) this.emit(message.type, message.data);
        else this.emit(message.type, message.data, socket);
      });

      socket.on('end', () => {
        this.emit('disconnect', socket);
        const index = connections.tcp.indexOf(socket);
        if (index !== -1) connections.tcp.splice(index, 1);
      });
    });
    server.listen(port);
    this.emit('status', 'TCP Socket listening on port:', port);
  };

  return this;
};

util.inherits(SocketServer, EventEmitter);
module.exports = SocketServer;
