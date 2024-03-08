const server_name = 'localhost';
const app = {
	media: {
		pc: null,
		localStream: null,
		remoteStream: null,
		activeCall: null,
		callUser: () => {
			
			const toToken = app.func.getActiveToken();
			if ( !toToken )
				return alert( "Something went wrong!" );
			
			app.skeleton.appendLocalStream().then( () => {
				app.func.getRPC().createOffer().then( offer => {
					return app.func.getRPC().setLocalDescription( offer );
				}).then( () => {
					// Request a call to the client (Your SDP)
					socket.emit( 'peer-offer', {
						toToken: toToken,
						myDescription: app.func.getRPC().localDescription
					});
					app.media.activeCall = toToken;
				}).catch( error => {
					console.error( 'Error local creating offer: ', error );
				});
			});
		},
		endCall: () => {
			let container = document.getElementById( 'call-container' );
			container.classList.add( 'd-none' );
			socket.emit( 'peer-answer', {
				toToken: app.media.activeCall,
				myDescription: '',
				active: 0
			});
			app.media.activeCall = null;
			document.getElementById( 'localVideo' ).srcObject = null;
			document.getElementById( 'remoteVideo' ).srcObject = null;
		}
	},
	chat: {
		usersMessages: {},
		pendingRequest: [],
		users: {
			friends: [],
			strangers: []
		},
		user: {
			name: null,
			token: null
		},
		active: {
			name: null,
			token: null
		},
		acceptRequest: ( token ) => {
			if ( confirm( "Are you sure you want to accept this user?" ) ) {
				if ( !token )
					return alert( "Something went wrong." );
				
				app.socket.sendAcceptedRequest( token );
				app.chat.pendingRequest = app.chat.pendingRequest.filter( item => item.token !== token );
				app.skeleton.refreshNotification();
			}
		},
		send: ( input ) => {
			const message = input.value.trim();
			const toToken = app.func.getActiveToken();
			
			switch ( true ) {
				case !toToken:
					return alert( 'Please select a friend first.' );
				case !message:
					return alert( 'Message input is required.' );
			}
			
			app.socket.sendChatMessage( toToken, message );
			app.func.saveMessage( toToken, {
				'type': 1,
				'message': message,
				'from': app.func.getName(),
				'time': app.func.getCurrentDateTime2()
			});
			app.skeleton.refreshChatBox( toToken );
			input.value = "";
		},
		addFriend: ( toToken ) => {
			if ( confirm( "Are you sure you want to add this user?" ) )	{
				if ( !toToken )
					return alert( "Something went wrong." );
				
				app.socket.sendFriendRequest( toToken );
			}
		}
	},
	socket: {
		registerNewUSer: () => {
			socket.emit( 'new-user', { 'token': app.func.getToken(), 'name': app.func.getName() });
		},
		listenUserConnected: () => {
			socket.on( 'user-connected', user => {
				if ( user.isFriend )
					app.skeleton.appendFriendList( user );
				else
					app.skeleton.appendGuestList( user );
			});
		},
		listenUserDisconnected: () => {
			socket.on( 'user-disconnected', user => app.skeleton.removeUserList( user.token, user.name ));
		},
		listenUserMessage: () => {
			socket.on( 'user-message', data => app.skeleton.appendMessage( data ) );
		},
		listenUserTyping: () => {
			socket.on( 'user-status-typing', data => app.skeleton.refreshChatTypingStatus( data ) );
		},
		listenPendingFriendRequest: () => {
			socket.on( 'pending-request-friend', user => {
				let requests = app.chat.pendingRequest;
				if ( requests.length ) {
					for ( let i = 0; i < requests.length; i++ ) {
						let obj = requests[ i ];
						if ( obj.token !== user.token ) {
							app.chat.pendingRequest.push( user );
						}
					}
				}
				else app.chat.pendingRequest.push( user );
				app.skeleton.refreshNotification();
			});
		},
		listenPeerRTCConnection: () => {
			// From the client that wants to connect.
			socket.on( 'peer-request', ( offer ) => {
				if ( !app.media.activeCall ) {
					swal.fire({
						title: "Incoming Call...",
						text: `${offer.fromName} is requesting a call, confirm?`,
						icon: "info",
						buttons: {
							cancel: "Cancel",
							confirm: "Accept Call"
						},
						closeOnClickOutside: false
					}).then( ( result ) => {
						app.media.activeCall = offer.fromToken;
						if ( result.isConfirmed ) {
							app.skeleton.appendLocalStream().then( () => {
								app.func.getRPC().setRemoteDescription( offer.remoteDescription ).then(() => {
									return app.func.getRPC().createAnswer();
								}).then( ( answer ) => {
									return app.func.getRPC().setLocalDescription(answer);
								}).then( () => {
									socket.emit( 'peer-answer', {
										toToken: offer.fromToken,
										myDescription: app.func.getRPC().localDescription,
										active: 1
									});
								}).catch( ( error ) => {
									console.error( 'Error setting remote description: ', error );
								});
							});
						}
						else {
							socket.emit( 'peer-answer', {
								toToken: offer.fromToken,
								myDescription: '',
								active: 0
							});
						}
					});
				} else {
					socket.emit( 'peer-answer', {
						toToken: offer.fromToken,
						myDescription: '',
						active: 1
					});
				}
			});
			// When the client accept your call
			socket.on( 'peer-answered', ( answer ) => {
				if ( !answer.remoteDescription ) {
					app.media.endCall();
					if ( answer.status === 1 ) {
						alert( 'User is already on call.' );
					}
				}
				else {
					app.func.getRPC().setRemoteDescription( answer.remoteDescription ).then( () => {
						console.log( 'Remote description set successfully' );
					}).catch( error => {
						console.error( 'Error setting remote description: ', error );
					});
				}
			});
			// For establishing connection (network)
			socket.on( 'peer-iceCandidate2', ( candidate ) => {
				app.func.getRPC().addIceCandidate( candidate ).catch( error => {
					console.error( 'Error adding ICE candidate: ', error );
				});
			});
		},
		sendUserTypingStatus: ( toToken, inputMessage ) => {
			if ( toToken ) {
				socket.emit( 'user-typing-status', {
					'toToken': toToken,
					'isTyping': ( inputMessage !== '' )
				});
			}
		},
		sendFriendRequest: ( toToken ) => {
			socket.emit( 'request-sent-friend', { 'toUserToken': toToken });
		},
		sendAcceptedRequest: ( toToken ) => {
			socket.emit( 'accept-friend-request', { 'userToken': toToken });
		},
		sendChatMessage: ( toToken, message ) => {
			socket.emit( 'send-chat-message', {
				'toToken': toToken,
				'message': message
			});
		}
	},
	init: () => {
		
		if ( !app.func.getName() )
			return;
		
		app.func.prepare();
		app.socket.registerNewUSer();
		app.socket.listenUserConnected();
		app.socket.listenUserDisconnected();
		app.socket.listenUserMessage();
		app.socket.listenUserTyping();
		app.socket.listenPendingFriendRequest();
		app.socket.listenPeerRTCConnection();
		
		app.listener.click();
		app.listener.messageInput();
		app.listener.peer();
	},
	listener: {
		messageInput: () => {
			let input = document.getElementById( 'message-input' );
			input.addEventListener( "keydown", ( event) => {
				if ( event.key === "Enter" ) {
					event.preventDefault();
					app.chat.send( input );
				}
				app.socket.sendUserTypingStatus( app.func.getActiveToken(), input.value );
			});
			input.addEventListener('keyup', ( event ) => {
				app.socket.sendUserTypingStatus( app.func.getActiveToken(), input.value );
			});
		},
		click: () => {
			document.addEventListener('click', function( event ) {
				let chatElement = document.getElementById( 'detect-unfocused' );
				let friendElements = document.querySelectorAll( '.friends-list' );
				
				if ( !app.func.isDescendant( chatElement, event.target ) && !Array.from( friendElements ).includes( event.target ) ) {
					let activeToken = app.func.getActiveToken();
					if ( activeToken )
						app.skeleton.toggleChatBox( false )
				}
			});
		},
		peer: ()  => {
			app.func.getRPC().onicecandidate = ( event ) => {
				if ( event.candidate ) {
					socket.emit( 'peer-iceCandidate', event.candidate );
				}
			};
			app.func.getRPC().ontrack = ( event ) => {
				let container = document.getElementById( 'call-container' );
				container.classList.remove( 'd-none' );
				if ( event.streams && event.streams[0] )
					document.getElementById( 'remoteVideo' ).srcObject = event.streams[0];
				else
					document.getElementById( 'remoteVideo' ).srcObject = new MediaStream( event.track );
			};
		}
	},
	skeleton: {
		appendLocalStream: async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
				
				// Display your local media camera
				app.media.localStream = stream;
				document.getElementById('localVideo').srcObject = stream;
				
				// Store your local media configuration (SDP)
				app.media.localStream.getTracks().forEach(track => {
					app.func.getRPC().addTrack(track, app.media.localStream);
				});
				
				return 'Local stream setup completed successfully';
				
			} catch ( err ) {
				console.error( 'Local stream error: ', err );
				throw err; // Rethrow the error to be caught by the caller
			}
		},
		appendMessage: ( data ) => {
			
			let unreadPill = document.querySelector( `[data-key="${data.fromToken}"]` ).querySelector( 'span' );
			let isActiveChat = app.func.getActiveToken() === data.fromToken;
			let message = data.message;
			let name = data.fromName;
			let time = data.timeSent;
			
			app.func.saveMessage( data.fromToken, {
				'type': 0,
				'from': name,
				'message': message,
				'time': time
			});
			
			if ( isActiveChat )
				app.skeleton.refreshChatBox( data.fromToken );
			
			else {
				let total = parseInt( unreadPill.innerHTML );
				unreadPill.innerText = total + 1;
			}
		},
		appendGuestList: ( user ) => {
			let html = document.getElementById( 'guest-list' );
			app.skeleton.removeUserList( user.token, user.name );
			if ( !app.chat.users.strangers.length ) {
				html.innerHTML = "";
			}
			
			html.innerHTML += `
			<li class="list-group-item d-flex justify-content-between align-items-center" data-key="${user.token}">
				${user.name}
				<span class="badge bg-primary rounded-pill" onclick="app.chat.addFriend( '${user.token}' )">Add +</span>
			</li>`;
			
			app.chat.users.strangers.push( user.token );
			document.getElementById( 'total-strangers' ).innerText = app.chat.users.strangers.length;
		},
		appendFriendList: ( user ) => {
			let html = document.getElementById( 'friend-list' );
			app.skeleton.removeUserList( user.token, user.name );
			if ( !app.chat.users.friends.length ) {
				html.innerHTML = "";
			}
			
			html.innerHTML += `
			<li class="list-group-item d-flex justify-content-between align-items-center cursor-pointer friends-list" data-key="${user.token}" onclick="app.func.setUser( '${user.token}', '${user.name}' )">
				${user.name}
				<span class="badge bg-primary rounded-pill">0</span>
			</li>`;
			
			app.chat.users.friends.push( user.token );
			document.getElementById( 'total-friends' ).innerText = app.chat.users.friends.length;
		},
		removeUserList: ( token, name ) => {
			document.querySelector( `[data-key="${token}"]` )?.remove();
			document.querySelector( `[to-key="${token}"]` )?.removeAttribute("value");
			document.querySelector( `[user-name="${name}"]` )?.removeAttribute("value");
			
			app.chat.pendingRequest = app.chat.pendingRequest.filter(item => item.token !== token);
			app.skeleton.refreshNotification();
			app.func.resetActive(token);
			
			[ "friends", "strangers" ].forEach(listName => {
				let index = app.chat.users[listName].indexOf(token);
				if ( index !== -1 ) {
					app.chat.users[listName].splice(index, 1);
					document.getElementById(`total-${listName}`).innerText = app.chat.users[listName].length;
				}
			});
			
			if ( !app.chat.users.friends.length ) {
				document.getElementById('friend-list').innerHTML = `<li class="list-group-item">
					<small>Find friends here now <a href="javascript:void(0)" onclick="app.skeleton.toggleUsersList(0)">Click here</a>.</small>
				</li>`;
			}
			
			if ( !app.chat.users.strangers.length ) {
				document.getElementById('guest-list').innerHTML = `<li class="list-group-item disabled">No users online.</li>`;
			}
			
			if ( token === app.media.activeCall ) {
				app.media.endCall();
			}
		},
		refreshNotification: () => {
			let html = "";
			let count = document.getElementById( 'total-notification' );
			let body = document.getElementById( 'notifications-body' );
			
			body.innerHTML = "";
			count.innerText = app.chat.pendingRequest.length;
			
			for ( let i = 0; i < app.chat.pendingRequest.length; i++ ) {
				let obj = app.chat.pendingRequest[ i ];
				html += `<tr>
					<td class="align-middle">${obj.name}</td>
					<td class="align-middle">${app.func.convertToTime( obj.dateCreated )}</td>
					<td class="align-middle text-center">
						<input type="button" class="btn btn-primary btn-sm" value="accept" onclick="app.chat.acceptRequest( '${obj.token}' )" />
						<input type="button" class="btn btn-danger btn-sm" value="reject" />
					</td>
				</tr>`;
			}
			body.innerHTML = html;
			
			if ( app.chat.pendingRequest.length === 0 )
				$('#notifications').modal('hide');
		},
		refreshChatBox: ( token, disconnect = false ) => {
			app.func.removeAllChildrenExceptOne( 'chat-message', 'chat-typing' );
			let container = document.getElementById( 'chat-message' );
			if ( app.chat.usersMessages[ token ] !== undefined ) {
				let sameUser = null;
				let chat = app.chat.usersMessages[ token ];
				for ( let i = 0; i < chat.length; i++ ) {
					let obj = chat[ i ];
					let idAttr = obj.from+'-'+i;
					let timeSent = app.func.convertToTime( obj.time );
					if ( obj.type )
						container.innerHTML += `<div class="chat-message" title="${timeSent}">${obj.message}<small id="${idAttr}"><br />${timeSent}</small></div>`;
					else
						container.innerHTML += `<div class="chat-message other" title="${timeSent}">${obj.message}<small id="${idAttr}"><br />${timeSent}</small></div>`;
					
					if ( sameUser === null )
						sameUser = obj.type;
					else {
						if ( obj.type === sameUser )
							document.getElementById( `${obj.from}-`+ ( i - 1 ) ).remove();
						else
							sameUser = obj.type;
					}
				}
			}
			
			if ( disconnect )
				container.innerHTML += `<div class="chat-message other">${app.func.getActiveName() ?? "User"} is disconnected.</div>`;
		},
		refreshChatTypingStatus: ( data ) => {
			let elem = document.getElementById( 'chat-typing' );
			if ( app.func.getActiveToken() ) {
				if ( data.isTyping )
					elem.classList.remove( 'display-none' );
				else
					elem.classList.add( 'display-none' );
			}
			else
				elem.classList.add( 'display-none' );
		},
		toggleChatBox: ( status ) => {
			let form = [
				'send-btn',
				'message-input',
				'video-call',
				'group-chat'
			];
			
			if ( !status ) {
				if ( app.func.getActiveToken() )
					app.socket.sendUserTypingStatus( app.func.getActiveToken(), '' );
			}
			
			for ( let i = 0; i < form.length; i++ ) {
				let elem =  document.getElementById( form[i] );
				if ( status ) {
					elem.removeAttribute( 'disabled' );
					elem.classList.remove( 'disabled' );
				}
				else {
					
					if ( app.func.isTextInput( elem ) )
						elem.value = "";
					
					app.func.removeAllChildrenExceptOne( 'chat-message', 'chat-typing' );
					document.getElementById( 'chat-typing' ).classList.add( 'display-none' );
					document.getElementById( 'user-name' ).innerText = "";
					
					elem.setAttribute( 'disabled', true );
					elem.classList.remove( 'disabled' );
					
					app.chat.active.name = null;
					app.chat.active.token = null;
				}
			}
		},
		toggleUsersList: ( type ) => {
			let guests = document.getElementById( 'guests-container' );
			let friends = document.getElementById( 'friends-container' );
			if ( type === 0 ) {
				friends.classList.add( 'display-none' );
				guests.classList.remove( 'display-none' );
			}
			else {
				guests.classList.add( 'display-none' );
				friends.classList.remove( 'display-none' );
			}
		},
	},
	func: {
		prepare: () => {
			app.media.pc = new RTCPeerConnection();
			app.skeleton.toggleUsersList( 0 );
			app.skeleton.toggleChatBox( false );
			document.getElementById( 'my-name' ).innerText = app.func.getName();
			document.getElementById( 'date-created' ).innerText = app.func.getCurrentDateTime();
		},
		setUser: ( token, name ) => {
			app.chat.active.name = name;
			app.chat.active.token = token;
			document.getElementById( 'user-name' ).innerText = name;
			document.querySelector( `[data-key="${token}"]` ).querySelector( 'span' ).innerHTML = "0";
			app.skeleton.refreshChatBox( token );
			app.skeleton.toggleChatBox( true );
		},
		getRPC: () => {
			return app.media.pc;
		},
		getActiveToken: () => app.chat.active.token,
		getActiveName: () => app.chat.active.name,
		getName: () => app.chat.user.name,
		getToken: () => app.chat.user.token,
		generateToken: ( length ) => {
			const values = new Uint8Array( length );
			window.crypto.getRandomValues( values );
			return Array.from( values, ( byte ) => byte.toString(16).padStart(2, '0')).join('');
		},
		resetActive: ( token ) => {
			if ( token === app.func.getActiveToken() ) {
				delete app.chat.usersMessages[ token ];
				app.skeleton.toggleChatBox( false );
				app.skeleton.refreshChatBox( token, true );
				document.getElementById( 'user-name' ).innerText = "";
				app.chat.active.name = null;
				app.chat.active.token = null;
			}
		},
		saveMessage: ( token, data ) => {
			if ( app.chat.usersMessages[ token ] === undefined )
				app.chat.usersMessages[ token ] = [];
			
			app.chat.usersMessages[ token ].push( data );
		},
		isDescendant: ( parent, child ) => {
			let node = child.parentNode;
			while ( node != null ) {
				if ( node === parent ) {
					return true;
				}
				node = node.parentNode;
			}
			return false;
		},
		removeAllChildrenExceptOne: ( parentId, elementIdToKeep ) => {
			const parentElement = document.getElementById( parentId );
			const children = parentElement.children;
			for ( let i = children.length - 1; i >= 0; i-- ) {
				const child = children[i];
				if ( child.id !== elementIdToKeep ) {
					parentElement.removeChild( child );
				}
			}
		},
		getCurrentDateTime: () => {
			const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
			const now = new Date();
			const monthStr = months[now.getMonth()];
			const day = String(now.getDate()).padStart(2, '0');
			const year = now.getFullYear();
			const hours = String(now.getHours()).padStart(2, '0');
			const minutes = String(now.getMinutes()).padStart(2, '0');
			const seconds = String(now.getSeconds()).padStart(2, '0');
			return `${monthStr} ${day}, ${year} ${hours}:${minutes}:${seconds}`;
		},
		getCurrentDateTime2: () => {
			const now = new Date();
			const year = now.getFullYear();
			const month = String(now.getMonth() + 1).padStart(2, '0');
			const day = String(now.getDate()).padStart(2, '0');
			const hours = String(now.getHours()).padStart(2, '0');
			const minutes = String(now.getMinutes()).padStart(2, '0');
			const seconds = String(now.getSeconds()).padStart(2, '0');
			return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
		},
		convertToTime: ( dateString ) => {
			let dateObj = new Date(dateString);
			return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
		},
		isTextInput: ( input ) => {
			return input && input.tagName.toLowerCase() === 'input' && input.type.toLowerCase() === 'text';
		}
	}
};

let UserName = "";
while ( !UserName ) {
	UserName = prompt("What is your name?");
	if ( !UserName ) {
		alert( "Name is required. Please enter your name." );
	}
}

const socket = io( `https://${server_name}:3000` );
app.chat.user.token = app.func.generateToken( 50 );
app.chat.user.name = UserName;
app.init();