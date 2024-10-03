import { IntegrationBase } from "@budibase/types"
import fetch from "node-fetch"
import { XeroClient,TokenSet, TokenSetParameters } from 'xero-node';
import nano from 'nano';

type TokenPair = {
  name: string;
  value: string | number;
};

interface Query {
  method: string
  body?: string
  headers?: { [token_set: string]: string }
}

interface DataSourceDocument {
  _id: string;
  _rev: string;
  config: {
    token_set?: object;
  };
}


class CustomIntegration implements IntegrationBase {
  private token_set: TokenSetParameters
  private readonly tenant_id: string
  private readonly client_id:string
  private readonly client_secret:string
  private readonly redirect_url:string
  private consent_url: string
  private readonly scopes: string
  private readonly couch_db_url: string
  private readonly couch_db_creds: string
  private readonly xero: XeroClient

  private readonly app_id: string;
  private readonly datasource_id: string;

  private expired_bool: boolean;


  constructor(config:{ client_id:string, client_secret:string, redirect_url:string, tenant_id: string, scopes:string, app_id:string, datasource_id:string, couch_db_url:string, couch_db_creds:string, token_set: TokenSetParameters}) {
    this.token_set = config.token_set

    this.consent_url = ""
    this.tenant_id = config.tenant_id
    this.client_id = config.client_id
    this.client_secret = config.client_secret
    this.redirect_url = config.redirect_url
    this.app_id = config.app_id
    this.datasource_id = config.datasource_id
    this.scopes = config.scopes
    this.couch_db_url = config.couch_db_url
    this.couch_db_creds = config.couch_db_creds
    this.expired_bool = new TokenSet(this.token_set).expired() ?? false // Might be needed later

    this.xero = new XeroClient({
      clientId: this.client_id,
      clientSecret: this.client_secret,
      redirectUris: [this.redirect_url],
      scopes: this.scopes.split(" "),
    });


    if (this.token_set && !(Object.keys(this.token_set).length === 0)){
        this.xero.setTokenSet(new TokenSet(this.token_set))
        if (this.expired_bool){
          this.oauthRefreshToken()
        }
    }
  }

  async showVars(){
    return [{url:`${this.couch_db_creds}@${this.couch_db_url}`,parseUrl: false}]
  }

  async updateTokensInDb(curr_token_set:TokenSetParameters){
    const curr_nano = nano({url:`${this.couch_db_creds}@${this.couch_db_url}`,parseUrl: false}); // Replace with your CouchDB URL
    let databases = [`app_dev_${this.app_id}`,`app_${this.app_id}`]
    for (var i = 0; i < databases.length; i++) {
      let db = curr_nano.db.use(databases[i])
      // Function to patch a document
        const doc = await db.get(`datasource_${this.datasource_id}`) as DataSourceDocument;
        doc.config = { ...doc.config, ...{"token_set":curr_token_set} }
        const updatedDoc = doc;
        const response = await db.insert(updatedDoc);
    }
  }


  async oauthBuildConsentUrl() {
    return [await this.xero.buildConsentUrl()]
  }

  async oauthGetTokenSet(query: { url: string }) {
    if (query.url == "default") {
      return ["Please enter a valid url"]
    }
    else {
      try {
        this.xero.initialize()
        let curr_token_set = await this.xero.apiCallback(query.url)
        await this.updateTokensInDb(curr_token_set)
      }
      catch (error) {
        throw Error("Unable to retreive tokens and update database ".concat(error as string))
      }
    }
    return [{"Status":"Updated Sucessfully"}]
  }

  async oauthRefreshToken() {
    if (new TokenSet(this.token_set).expired()){
      await this.xero.initialize()
      const validTokenSet = await this.xero.refreshToken()
      this.updateTokensInDb(validTokenSet)
    }
    else {
      return ["Token is not expired"]
    }
  }

  async request(url: string, opts: Query) {

    const response = await fetch(url, opts)
    if (response.status <= 300) {
      try {
        const contentType = response.headers.get("content-type")
        if (contentType?.includes("json")) {
          return await response.json()
        } else {
          return await response.text()
        }
      } catch (err) {
        return await response.text()
      }
    } else {
      const err = await response.text()
      throw new Error(err)
    }
  }

  async read(query: { id: string, extra: { [key: string]: string }  }) {
    await this.xero.initialize()
    if (this.expired_bool){
      throw Error('Expired token, please refresh')
    }
    else if (query.extra.endpoint == "Invoices"){
      let invoice = await this.xero.accountingApi.getInvoice(this.tenant_id, query.id);
      return invoice.body
    }
    else if (query.extra.endpoint == "Repeating Invoices"){
      let repeating_invoice = await this.xero.accountingApi.getRepeatingInvoice(this.tenant_id, query.id);
      return repeating_invoice.body
    }
    else {
      throw Error('Please select a valid endpoint');
    }
  }

  async list(query: { queryString: string, extra: { [key: string]: string } }) {
    await this.xero.initialize()
    if (this.expired_bool){
      throw Error('Expired token, please refresh')
    }
    else if (query.extra.endpoint == "Invoices"){
      let invoices = await this.xero.accountingApi.getInvoices(this.tenant_id);
      return invoices.body
    }
    else if (query.extra.endpoint == "Repeating Invoices"){
      let repeating_invoices = await this.xero.accountingApi.getRepeatingInvoices(this.tenant_id);
      return repeating_invoices.body
    }
    else {
      throw Error('Please select a valid endpoint');
    }
  }
}

export default CustomIntegration
