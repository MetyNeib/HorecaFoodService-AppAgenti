import { RalixApp } from 'ralix';
import WorkspaceController from 'controllers/workspace';
import HomeController from 'controllers/home';
import OrdersController from 'controllers/orders';
import CustomersController from 'controllers/customers';
import CatalogController from 'controllers/catalog';
import FastorderController from 'controllers/fastorder';
import InsightsController from 'controllers/insights';
import Amelia3Controller from 'controllers/amelia3';

// Ralix owns the page controller; interactions are delegated through *_js hooks.
const app = new RalixApp({ routes: { '^/amelia3': Amelia3Controller, '^/$': HomeController, '^/orders': OrdersController, '^/customers': CustomersController,
  '^/catalog': CatalogController, '^/fastorder': FastorderController, '^/insights': InsightsController, '/.*': WorkspaceController } });
app.start();
