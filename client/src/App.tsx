import React from "react";
import axios from "axios";
import { Route, Switch, Redirect, Link } from "react-router-dom";
import "antd/dist/antd.css";
import "./App.css";
import { Layout, Menu } from "antd";
const { Header, Content, Footer } = Layout;
import { QuestionCircleOutlined } from "@ant-design/icons";

import { baseAPIURL } from "./api";
import { User } from "./models/models";
import Events from "./components/events";
import Calendar from "./components/calendar";
import Home from "./components/home";
import Sync from "./components/sync";
import Help from "./components/help";

class App extends React.Component {
  state: { user: User | null; redirectToHome: boolean } = {
    user: null,
    redirectToHome: false,
  };

  async componentDidMount(): Promise<void> {
    // Check if the session cookie is valid, in which case we're authorized
    try {
      const res = await axios.get(`${baseAPIURL}/users/me`, {
        withCredentials: true,
      });
      console.log("Auth: The user is confirmed to be authenticated");
      this.setState({ user: res.data, redirectToHome: false });
      /* eslint-disable  @typescript-eslint/no-explicit-any */
    } catch (err: any) {
      // API will respond with a 401 if the session cookie is missing or invalid
      if (
        err &&
        err.response &&
        err.response.status &&
        err.response.status == 401
      ) {
        console.log("User is NOT logged in");
      }
      this.setState({ redirectToHome: true });
    }
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  /* eslint-disable @typescript-eslint/explicit-module-boundary-types */
  async handleClick(e: any): Promise<void> {
    if (e.key == "user" && this.state.user) {
      console.log("Logging user out");
      try {
        await axios.get(`${baseAPIURL}/auth/logout`, {
          withCredentials: true,
        });
        this.setState({ user: null, redirectToHome: true });
      } catch (err) {
        console.error(err);
      }
    }
  }

  render(): React.ReactNode {
    return (
      <>
        <Layout id="top-level-layout" className="layout">
          <Header>
            <div className="logo" />
            <Menu
              theme="dark"
              mode="horizontal"
              defaultSelectedKeys={["calendar"]}
              onClick={this.handleClick.bind(this)}
            >
              {/* {!this.state.user && ( */}
              {/*   <Menu.Item key="home"> */}
              {/*     <Link to="/">Home</Link> */}
              {/*   </Menu.Item> */}
              {/* )} */}
              {this.state.user && (
                <>
                  <Menu.Item key="calendar" data-cy="calendar">
                    <Link to="/calendar">Calendar</Link>
                  </Menu.Item>
                  <Menu.Item key="events" data-cy="events">
                    <Link to="/events">Events</Link>
                  </Menu.Item>
                  <Menu.Item
                    className="ant-menu-item-right"
                    key="help"
                    data-cy="help"
                  >
                    <Link to="/help">
                      Help <QuestionCircleOutlined />
                    </Link>
                  </Menu.Item>
                  <Menu.Item key="user" data-cy="logout">
                    Logout
                  </Menu.Item>
                </>
              )}
            </Menu>
          </Header>
          <Content style={{ padding: "50px 50px 0px 50px" }}>
            {/* <Breadcrumb style={{ margin: "16px 0" }}> */}
            {/*   <Breadcrumb.Item>Home</Breadcrumb.Item> */}
            {/*   {/1* <Breadcrumb.Item>List</Breadcrumb.Item> *1/} */}
            {/*   {/1* <Breadcrumb.Item>App</Breadcrumb.Item> *1/} */}
            {/* </Breadcrumb> */}
            <div className="site-layout-content">
              <Switch>
                <Route path="/events">
                  <Events />
                </Route>
                <Route path="/calendar">
                  <Calendar />
                </Route>
                <Route path="/sync">
                  <Sync />
                </Route>
                <Route path="/help">
                  <Help />
                </Route>
                <Route path="/">
                  <div>
                    <Home user={this.state.user} />
                  </div>
                </Route>
              </Switch>
            </div>
          </Content>
          <Footer style={{ textAlign: "center" }}>
            Kurilin Industries LLC 2022
          </Footer>
        </Layout>
        {/* this seems a little horrible, but it's the only option unless we want to */}
        {/* go the hooks route */}
        {this.state.redirectToHome && <Redirect to="/" />}
      </>
    );
  }
}

export default App;
