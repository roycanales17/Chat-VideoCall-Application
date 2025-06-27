const frontend = "https://127.0.0.1:3000";
const server_host = 'localhost';
const server_port = 3030;

const https = require('https');
const fs = require('fs');
const socketIO = require('socket.io');

const server = https.createServer({
	key: fs.readFileSync(`certs/localhost-key.pem`),
	cert: fs.readFileSync(`certs/localhost.pem`)
}, (req, res) => {
	res.writeHead(200, { 'Content-Type': 'text/plain' });
	res.end('Hello, World!\n');
});

const io = socketIO(server, {
	cors: {
		origin: frontend,
		methods: ['GET', 'POST']
	}
});

server.listen(server_port, server_host, () => {
	console.log(`Server running at https://${server_host}:${server_port}/`);
});

let users = {};
let object = {
	removeUser: ( id ) => delete users[ id ],
	checkIfFriend: ( myToken, clientToken ) => {
		let client = object.getUserInfo( object.getUserSocket( clientToken ) );
		if ( client )
			return client.friendList.includes( myToken );
		return false;
	},
	
	registerNewUSer: ( user, id ) => {
		users[ id ] = {
			'token': user.token,
			'name': user.name,
			'isFriend': false,
			'friendList': [],
			'dateCreated': object.getCurrentDateTime()
		}
	},
	registerNewFriend: ( clientToken, myID ) => {
		
		let myInfo = object.getUserInfo( myID );
		
		if ( !myInfo.friendList.includes( clientToken ) )
			users[ myID ].friendList.push( clientToken );
		
		let clientID = object.getUserSocket( clientToken );
		let clientInfo = object.getUserInfo( clientID );
		
		if ( clientInfo ) {
			if ( !clientInfo.friendList.includes( myInfo.token ) )
				users[ clientID ].friendList.push( myInfo.token );
		}
	},
	
	getUserInfo: ( id ) => {
		return users[ id ] ?? false;
	},
	getCurrentDateTime: () => {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const seconds = String(now.getSeconds()).padStart(2, '0');
		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	},
	getUserSocket: ( clientToken ) => {
		for ( const id in users ) {
			if ( users[ id ].token === clientToken )
				return id;
		}
		return false;
	},
};

io.on( 'connection' , socket => {
	
	socket.on( 'new-user', user => {
		object.registerNewUSer( user, socket.id );
		const myInfo = object.getUserInfo( socket.id );
		if ( myInfo ) {
			for ( const clientID in users ) {
				let clientAttr = object.getUserInfo( clientID );
				if ( clientAttr.token !== myInfo.token ) {
					myInfo.isFriend = object.checkIfFriend( myInfo.token, clientAttr.token );
					io.to( clientID ).emit( 'user-connected', myInfo );
				}
				else {
					for ( const clientID2 in users ) {
						let clientAttr2 = object.getUserInfo( clientID2 );
						if ( clientAttr2.token !== myInfo.token ) {
							clientAttr2.isFriend = object.checkIfFriend( clientAttr2.token, myInfo.token );
							io.to( socket.id ).emit( 'user-connected', clientAttr2 );
						}
					}
				}
			}
		}
	});
	socket.on( 'request-sent-friend', user => {
		let myID = socket.id;
		let myInfo = object.getUserInfo( myID );
		let toUserToken = user.toUserToken;
		if ( toUserToken ) {
			let toClientID = object.getUserSocket( toUserToken );
			if ( toClientID ) {
				let data = {
					'name': myInfo.name,
					'token': myInfo.token,
					'dateCreated': object.getCurrentDateTime()
				};
				io.to( toClientID ).emit( 'pending-request-friend', data );
			}
		}
	});
	socket.on( 'accept-friend-request', data => {
		const clientToken = data.userToken;
		object.registerNewFriend( clientToken, socket.id );
		
		let myID = socket.id;
		let myInfo = object.getUserInfo( socket.id );
		let clientID = object.getUserSocket( clientToken );
		let clientInfo = object.getUserInfo( clientID );
		
		myInfo.isFriend = object.checkIfFriend( clientInfo.token, myInfo.token );
		clientInfo.isFriend = object.checkIfFriend( myInfo.token, clientInfo.token );
		
		io.to( clientID ).emit( 'user-connected', myInfo );
		io.to( myID ).emit( 'user-connected', clientInfo );
	});
	socket.on( 'user-typing-status', data => {
		let myInfo = object.getUserInfo( socket.id );
		let clientID = object.getUserSocket( data.toToken );
		if ( object.checkIfFriend( data.toToken, myInfo.token ) ) {
			io.to( clientID ).emit( 'user-status-typing', {
				'fromToken': myInfo.token,
				'isTyping': data.isTyping
			});
		}
	});
	socket.on( 'send-chat-message', data => {
		let myInfo = object.getUserInfo( socket.id );
		let clientID = object.getUserSocket( data.toToken );
		if ( object.checkIfFriend( data.toToken, myInfo.token ) ) {
			delete data[ 'toToken' ];
			data[ 'fromName' ] = myInfo.name;
			data[ 'fromToken' ] = myInfo.token;
			data[ 'timeSent' ] = object.getCurrentDateTime();
			io.to( clientID ).emit( 'user-message', data );
		}
	});
	socket.on( 'peer-offer', data => {
		const toToken = data.toToken;
		const myDescription = data.myDescription;
		const myInfo = object.getUserInfo( socket.id );
		const clientID = object.getUserSocket( toToken );
		if ( object.checkIfFriend( toToken, myInfo.token ) ) {
			io.to( clientID ).emit( 'peer-request', {
				'fromName': myInfo.name,
				'fromToken': myInfo.token,
				'remoteDescription': myDescription
			});
		}
	});
	socket.on( 'peer-answer', data => {
		const toToken = data.toToken ?? '';
		const myDescription = data.myDescription ?? '';
		const myInfo = object.getUserInfo( socket.id );
		const clientID = object.getUserSocket( toToken );
		if ( object.checkIfFriend( toToken, myInfo.token ) ) {
			io.to( clientID ).emit( 'peer-answered', {
				'fromToken': myInfo.token,
				'remoteDescription': myDescription,
				'status': data.status ?? 0
			});
		}
	});
	socket.on( 'peer-iceCandidate', candidate => {
		socket.broadcast.emit( 'peer-iceCandidate2', candidate );
	});
	socket.on( 'disconnect', () => {
		const myId = socket.id;
		const info = object.getUserInfo( myId );
		for ( const clientID in users ) {
			let clientAttr = users[ clientID ];
			io.to( clientID ).emit( 'user-disconnected', {
				'token': info.token,
				'isFriend': object.checkIfFriend( clientAttr.token, info.token ),
				'name': info.name
			});
		}
		object.removeUser( myId );
	});
});
