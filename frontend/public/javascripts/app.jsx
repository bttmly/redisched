/*
message schema
{
  created_at: Number,
  delay: Number,
  id: String,
  body: String,
  status: "pending" | "completed" | "cancelled"
}
*/

const { React, ReactDOM, io } = window;

class App extends React.Component {
  constructor (props) {
    super(props);
    this.state = { messages: [] };
    this._socket = io();
    this._socket.on("message_scheduled", m => this._onScheduled(m));
    this._socket.on("message_cancelled", ({id}) => this._onCancelled(id));
    this._socket.on("message_completed", ({id}) => this._onCompleted(id));
    this._ticker = setInterval(() => this.forceUpdate(), 250);
  }

  render () {
    const [pending, finished] = partition(
      this.state.messages, m => m.status === "pending"
    );

    return (
      <div>
        <MessageForm socket={this._socket}/>
        <div id="listing">
          <div className="listing-panel">
            <h2>pending</h2>
            <ul id="pending_messages">
              { pending.map(msg =>
                <li
                  className="listing-message pending"
                  onClick={() => this._cancelMessage(msg.id)}
                  key={msg.id}
                >
                  { `{ id: ${msg.id}, expires_in: ${timeUntilReady(msg)}s }` }
                </li>
              )}
            </ul>
          </div>

          <div className="listing-panel">
            <h2>finished</h2>
            <ul id="finished_messages">
              { finished.map(msg =>
                <li
                  className={`listing-message ${msg.status}`}
                  onClick={() => this._clearMessage(msg.id)}
                  key={msg.id}
                >
                  { `{ id: ${msg.id}, status: ${msg.status} }` }
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  _onScheduled (message) {
    this.setState(state => ({
      messages: state.messages.concat(message),
    }));
  }

  _clearMessage (id) {
    this.setState(state => ({
      messages: state.messages.filter(m => m.id !== id),
    }));
  }

  _onCancelled (id) {
    this._setStatusOnMessageId(id, "cancelled");
  }

  _onCompleted (id) {
    this._setStatusOnMessageId(id, "completed");
  }

  _cancelMessage (id) {
    this._socket.emit("cancel_message", { id });
  }

  _setStatusOnMessageId (id, status) {
    this.setState(({messages}) => {
      const [[target], others] = partition(messages, m => m.id === id);
      target.status = status;
      return { messages: others.concat(target) };
    });
  }
}

class MessageForm extends React.Component {
  constructor (props) {
    super(props);
    this.state = _newState();
  }

  render () {
    return (
      <div>
        { this._inputField("id") }
        { this._inputField("body") }
        { this._inputField("delay") }
        <button
          className="message-button"
          onClick={() => {
            this.props.socket.emit("send_message", this.state);
            this.setState(_newState(this.state.delay));
          }}
        >
          Submit
        </button>
      </div>
    );
  }

  _inputField (stateValue) {
    return (
      <input
        className="message-field"
        value={this.state[stateValue]}
        type="text"
        placeholder={stateValue}
        onChange={evt => this.setState({
          [stateValue]: evt.target.value,
        })}
      />
    );
  }
}

ReactDOM.render(
  <App />,
  document.getElementById("app")
);

function sample (arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function partition (arr, fn) {
  return arr.reduce(function (results, item) {
    results[fn(item) ? 0 : 1].push(item);
    return results;
  }, [[], []]);
}

function timeUntilReady (message) {
  const now = Date.now();
  const expiry = message.created_at + (1000 * message.delay);
  return Math.floor((expiry - now) / 1000);
}

// 16 hex characters
function uid () {
  return Array.from(crypto.getRandomValues(new Uint32Array(2)))
    .map(n => n.toString(16)).join("");
}

function _newState (delay) {
  const MESSAGES = [
    "Hello!",
    "Bonjour!",
    "¡Hola!",
    "Ciao!",
  ];
  const DEFAULT_DELAY = 5;

  return {
    id: uid(),
    body: sample(MESSAGES),
    delay: delay || DEFAULT_DELAY,
  };
}
