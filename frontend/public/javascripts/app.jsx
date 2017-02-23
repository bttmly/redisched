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

const { React, _ } = window;

class App extends React.Component {
  constructor (props) {
    super(props);
    this.state = { messages: [] };
    this._socket = window.io();
    this._socket.on("message_scheduled", m => this._onScheduled(m));
    this._socket.on("message_cancelled", ({id}) => this._onCancelled(id));
    this._socket.on("message_completed", ({id}) => this._onCompleted(id));
    this._ticker = setInterval(() => this.forceUpdate(), 250);
  }

  render () {
    const [pending, finished] = _.partition(
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
    )
  }

  _onScheduled (message) {
    this.setState(state => ({
      messages: state.messages.concat(message)
    }));
  }

  _onCancelled (id) {
    this.setState(state => {
      const [[target], others] = _.partition(state.messages, m => m.id === id);
      target.status = "cancelled";
      return { messages: others.concat(target) };
    })
  }

  _onCompleted (id) {
    this.setState(state => {
      const [[target], others] = _.partition(state.messages, m => m.id === id);
      if (target == null) {
        console.log("no message found for id", id)
        return { messages: others };
      }
      target.status = "completed";
      return { messages: others.concat(target) };
    })
  }

  _clearMessage (id) {
    this.setState(state => {
      messages = _.reject(state.messages, m => m.id === id);
      return { messages };
    });
  }

  _cancelMessage (id) {
    this._socket.emit("cancel_message", { id });
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
    )
  }

  _inputField (stateValue) {
    return (
      <input
        className="message-field"
        value={this.state[stateValue]}
        type="text"
        placeholder={stateValue}
        onChange={evt => this.setState({
          [stateValue]: evt.target.value
        })}
      />
    );
  }
}

ReactDOM.render(
  <App />,
  document.getElementById("app")
);

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
    body: _.sample(MESSAGES),
    delay: delay || DEFAULT_DELAY,
  };
}
