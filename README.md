# A3-xero-datasource
This is a readme for your new Budibase plugin.

# Description
A datasource to interact with XERO api

Find out more about [Budibase](https://github.com/Budibase/budibase).

## Instructions

This XERO plugin authenticates using OAUth and should be used in conjuction with the Xero Panel.

A custom screen should be created which does the following 
- Provides consent URL
- XERO should redirect user back to budibase xero screen
- URL will be parsed by XERO panel 
- The after/before submit button action should be set up to insert value into database
- Refresh token query should be called periodically and will also be called when object is constructed