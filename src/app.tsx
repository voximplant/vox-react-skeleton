declare function require(string): string;
import * as $ from 'jquery';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as VoxImplant from 'voximplant-websdk';
import { Button, ButtonGroup, ButtonToolbar, Modal, DropdownButton, MenuItem } from 'react-bootstrap';
require('./app.scss');

enum AppViews {
	IDLE,
	INIT,
	ERROR,
	AUTH,
	APP,
	FINISH
}

interface State {
	view: AppViews;
	tip?: string;
	showModal?: boolean;
}

class App extends React.Component<any, any> {

	voxAPI: VoxImplant.Client;
	appname: string = 'app';
	accname: string = 'acc';
	displayName: string;
	username: string = 'webuser';
	call: VoxImplant.Call;
	wsURL: string = '//demos.voximplant.com/acc/auth.php';

	state: State = {
		view: AppViews.IDLE,
		tip: "Пожалуйста, разрешите доступ к вашему микрофону",
		showModal: false
	};

	constructor() {
		super();
		this.voxAPI = VoxImplant.getInstance();
		// Init
		this.voxAPI.addEventListener(VoxImplant.Events.SDKReady,
			(e: VoxImplant.Events.SDKReady) => this.voxReady(e));
		// Connection
		this.voxAPI.addEventListener(VoxImplant.Events.ConnectionEstablished,
			(e) => this.voxConnectionEstablished(e));
		this.voxAPI.addEventListener(VoxImplant.Events.ConnectionFailed,
			() => this.voxConnectionFailed());
		this.voxAPI.addEventListener(VoxImplant.Events.ConnectionClosed,
			(e) => this.voxConnectionClosed(e));
		// Auth
		this.voxAPI.addEventListener(VoxImplant.Events.AuthResult,
			(e: VoxImplant.Events.AuthResult) => this.voxAuthEvent(e));
		// Misc
		this.voxAPI.addEventListener(VoxImplant.Events.MicAccessResult,
			(e: VoxImplant.Events.MicAccessResult) => this.voxMicAccessResult(e));
		// Inbound calls
		this.voxAPI.addEventListener(VoxImplant.Events.IncomingCall,
			(e: VoxImplant.Events.IncomingCall) => this.voxInboundCall(e));				 
	}


	start() {
		if (this.state.view == AppViews.FINISH) {
			return;
		}
		this.setState({
			view: AppViews.INIT
		})
		try {
			this.voxAPI.init({
				useRTCOnly: true,
				micRequired: true,
			});
		} catch(e) {
			this.setState({
				view: AppViews.ERROR,
				tip: "Необходим браузер с поддержкой технологии WebRTC, воспользуйтесь, пожалуйста, Chrome/Chromium, Firefox или Opera"
			});
		}
	}

	voxReady(event: VoxImplant.Events.SDKReady) {
		console.log("VoxImplant WebSDK Ready v. " + event.version);
		console.log(this.voxAPI.isRTCsupported());
		if (!this.voxAPI.isRTCsupported()) {
			this.setState({
				view: AppViews.ERROR,
				tip: "Необходим браузер с поддержкой технологии WebRTC, воспользуйтесь, пожалуйста, Chrome/Chromium, Firefox или Opera"
			});
		}
		else {
			this.voxAPI.connect();
		}
	}

	voxMicAccessResult(event: VoxImplant.Events.MicAccessResult) {
		console.log("Mic access " + (event.result ? "allowed" : "denied"));
		if (event.result) {
			this.setState({ tip: "Установка соединения" });
		}
		else {
			this.setState({ tip: "Для работы сервиса необходимо разрешить доступ к камере и микрофону" });
		}
	}

	voxConnectionEstablished(event: VoxImplant.Events.ConnectionEstablished) {
		console.log("VoxImplant connected");
		this.setState({ view: AppViews.AUTH, tip: "Авторизация" });
		this.voxAPI.requestOneTimeLoginKey("webuser@app.acc.voximplant.com");
	}

	voxConnectionFailed() {
		console.log("Connectioned failed");
		this.setState({
			view: AppViews.ERROR,
			tip: "Соединение с VoxImplant не может быть установлено"
		});
	}

	voxConnectionClosed(event: VoxImplant.Events.ConnectionClosed) {
		console.log("Connectioned closed");
		this.setState({
			view: AppViews.ERROR,
			tip: "Соединение с VoxImplant было закрыто"
		});
	}

	voxAuthEvent(event: VoxImplant.Events.AuthResult) {

		if (event.result) {
			this.displayName = event.displayName;
			this.call = this.voxAPI.call("default", true);
			this.call.addEventListener(VoxImplant.CallEvents.Disconnected,
				(e: VoxImplant.CallEvents.Disconnected) => this.callDisconnected(e));
			this.call.addEventListener(VoxImplant.CallEvents.Connected,
				(e: VoxImplant.CallEvents.Connected) => this.callConnected(e));
			this.call.addEventListener(VoxImplant.CallEvents.Failed,
				(e: VoxImplant.CallEvents.Failed) => this.callFailed(e));
			this.setState({ view: AppViews.AUTH, tip: "звонок" });
		} else {
			if (event.code == 302) {
				let uid = this.username + "@" + this.appname + "." + this.accname + ".voximplant.com";
				$.get(this.wsURL + '?key=' + event.key + '&username=' + this.username, function(data) {
					if (data != "NO_DATA") {
						this.voxAPI.loginWithOneTimeKey(uid, data);
					}
				}.bind(this));
			} else {				
				this.setState({
					view: AppViews.ERROR,
					tip: "Ошибка авторизации"
				});
			}
		}

	}

	voxInboundCall(event: VoxImplant.Events.IncomingCall) {
		console.log("Inbound call from " + event.call.displayName);
		this.call = event.call;
		this.call.addEventListener(VoxImplant.CallEvents.Disconnected,
			(e: VoxImplant.CallEvents.Disconnected) => this.callDisconnected(e));
		this.call.addEventListener(VoxImplant.CallEvents.Connected,
			(e: VoxImplant.CallEvents.Connected) => this.callConnected(e));
		this.openModal();
	}

	callDisconnected(event: VoxImplant.CallEvents.Disconnected) {
		this.setState({ view: AppViews.FINISH });
	}

	callConnected(event: VoxImplant.CallEvents.Connected) {		
		this.setState({ view: AppViews.APP, tip: "" });
	}

	callFailed(event: VoxImplant.CallEvents.Failed) {
	}

	hangupCall() {
		this.call.hangup();
	}

	closeModal() {
		this.setState({
			showModal: false
		});
	}

	openModal() {
		this.setState({
			showModal: true
		});
	}

	render() {
		let element: JSX.Element = <div></div>;

		switch (this.state.view) {
			case AppViews.IDLE:
				return (
					<div>
						{element}
					</div>
				);
				break;

			case AppViews.INIT:
			case AppViews.AUTH:
				return (
					<div>
						<a href="javascript:void(0)">call</a>
					</div>
				);
				break;

			case AppViews.ERROR:
				return (
					<div>
						<div>{this.state.tip}</div>
					</div>
				);
				break;

			case AppViews.APP:
				return (
					<div>
						call in progress
						<a href="javascript:void(0)"
							onClick={() => this.hangupCall() }>
							hangup
						</a>
					</div>
				);
				break;

			case AppViews.FINISH:
				return (
					<div>call finished</div>
				);
				break;

			default:
				return <div></div>;
				break;
		}
	}

}

export default App;

ReactDOM.render(<App />, document.getElementById('app'));

